/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS203: Remove `|| {}` from converted for-own loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let ensureDawnOfTime, newMessage;
import { PRESENCE_KEEPALIVE_MINUTES } from '/lib/imports/constants.coffee';
import { BBCollection, CalendarEvents, Calendar, CallIns, LastRead, Messages, Names, Polls, Presence, Puzzles, Roles, Rounds, collection, pretty_collection } from '/lib/imports/collections.coffee';
import canonical from './imports/canonical.coffee';
import isDuplicateError from './imports/duplicate.coffee';
import { drive as driveEnv } from './imports/environment.coffee';
import { ArrayMembers, ArrayWithLength, EqualsString, NumberInRange, NonEmptyString, IdOrObject, ObjectWith, OptionalKWArg } from './imports/match.coffee';
import { IsMechanic } from './imports/mechanics.coffee';
import { getTag, isStuck, canonicalTags } from './imports/tags.coffee';
import { RoundUrlPrefix, PuzzleUrlPrefix, RoleRenewalTime, UrlSeparator } from './imports/settings.coffee';
import * as callin_types from './imports/callin_types.coffee';
if (Meteor.isServer) {
  ({newMessage, ensureDawnOfTime} = require('/server/imports/newMessage.coffee'));
} else {
  newMessage = function() {};
  ensureDawnOfTime = function() {};
}
// Blackboard -- data model
// Loaded on both the client and the server

(function() {
  // private helpers, not exported
  const unimplemented = function() { throw new Meteor.Error(500, "Unimplemented"); };

  // a key of BBCollection
  const ValidType = Match.Where(function(x) {
    check(x, NonEmptyString);
    return Object.prototype.hasOwnProperty.call(BBCollection, x);
  });
    
  const oplog = (message, type, id, who, stream='') => Messages.insert({
    room_name: 'oplog/0',
    nick: canonical(who),
    timestamp: Date.now(),
    body: message,
    bodyIsHtml: false,
    type,
    id,
    oplog: true,
    followup: true,
    action: true,
    system: false,
    to: null,
    stream
  });

  const newObject = function(type, args, extra, options={}) {
    check(args, ObjectWith({
      name: NonEmptyString,
      who: NonEmptyString
    })
    );
    const now = Date.now();
    const object = {
      name: args.name,
      canon: canonical(args.name), // for lookup
      created: now,
      created_by: canonical(args.who),
      touched: now,
      touched_by: canonical(args.who),
      tags: canonicalTags(args.tags || [], args.who)
    };
    const object1 = extra || Object.create(null);
    for (let key of Object.keys(object1 || {})) {
      const value = object1[key];
      object[key] = value;
    }
    object._id = collection(type).insert(object);
    if (!options.suppressLog) {
      oplog("Added", type, object._id, args.who, 
          ['puzzles', 'rounds'].includes(type) 
              ? 'new-puzzles' : ''
      );
    }
    return object;
  };

  const renameObject = function(type, args, options={}) {
    check(args, ObjectWith({
      id: NonEmptyString,
      name: NonEmptyString,
      who: NonEmptyString
    })
    );
    const now = Date.now();

    // Only perform the rename and oplog if the name is changing
    // XXX: This is racy with updates to findOne().name.
    if (collection(type).findOne(args.id).name === args.name) {
      return false;
    }

    try {
      collection(type).update(args.id, { $set: {
        name: args.name,
        canon: canonical(args.name),
        touched: now,
        touched_by: canonical(args.who)
      }
    }
      );
    } catch (error) {
      // duplicate name--bail out
      if (isDuplicateError(error)) {
        return false;
      }
      throw error;
    }
    if (!options.suppressLog) {
      oplog("Renamed", type, args.id, args.who);
    }
    return true;
  };

  const deleteObject = function(type, args, options={}) {
    check(type, ValidType);
    check(args, ObjectWith({
      id: NonEmptyString,
      who: NonEmptyString,
      condition: Match.Optional(Object)
    })
    );
    const condition = args.condition ?? {};
    const name = collection(type).findOne(args.id)?.name;
    if (!name) { return false; }
    const result = collection(type).remove({_id: args.id, ...condition});
    if (result === 0) { return false; }
    if (!options.suppressLog) {
      oplog("Deleted "+pretty_collection(type)+" "+name, 
          type, null, args.who);
    }
    return true;
  };

  const setTagInternal = function(updateDoc, args) {
    check(args, ObjectWith({
      name: NonEmptyString,
      value: Match.Any,
      who: NonEmptyString,
      now: Number
    })
    );
    if (updateDoc.$set == null) { updateDoc.$set = {}; }
    updateDoc.$set[`tags.${canonical(args.name)}`] = { 
      name: args.name,
      value: args.value,
      touched: args.now,
      touched_by: canonical(args.who)
    };
    return true;
  };

  const deleteTagInternal = function(updateDoc, name) {
    check(name, NonEmptyString);
    if (updateDoc.$unset == null) { updateDoc.$unset = {}; }
    updateDoc.$unset[`tags.${canonical(name)}`] = '';
    return true;
  };

  const newDriveFolder = function(id, name) {
    check(id, NonEmptyString);
    check(name, NonEmptyString);
    if (!Meteor.isServer) { return; }
    let res = null;
    try {
      res = driveEnv.get()?.createPuzzle(name) ?? {};
      if (!res?.id) {
        res.status = 'skipped';
      }
    } catch (e) {
      res = {status: 'failed'};
      if (e instanceof Error) {
        res.message = `${e.name}: ${e.message}`;
      } else {
        res.message = `${e}`;
      }
    }
    return Puzzles.update(id, {
      $set: {
        drive_status: res.status ?? null,
        drive_error_message: res.message,
        drive: res.id,
        spreadsheet: res.spreadId
      }
    }
    );
  };

  const renameDriveFolder = function(new_name, drive, spreadsheet) {
    check(new_name, NonEmptyString);
    check(drive, NonEmptyString);
    check(spreadsheet, Match.Optional(NonEmptyString));
    if (!Meteor.isServer) { return; }
    return driveEnv.get()?.renamePuzzle(new_name, drive, spreadsheet);
  };

  const deleteDriveFolder = function(drive) {
    check(drive, NonEmptyString);
    if (!Meteor.isServer) { return; }
    return driveEnv.get()?.deletePuzzle(drive);
  };

  const moveWithinParent = Meteor.isServer ?
    require('/server/imports/move_within_parent.coffee').default
  :
    require('/client/imports/move_within_parent.coffee').default;

  const settableFields = {
    callins: {
      callin_type: OptionalKWArg(callin_types.IsCallinType),
      submitted_by: OptionalKWArg(NonEmptyString),
      submitted_to_hq: OptionalKWArg(Boolean)
    },
    puzzles: {
      link: OptionalKWArg(String),
      order_by: Match.Optional(Match.OneOf(EqualsString(''), EqualsString('name')))
    }
  };
      
  return Meteor.methods({
    newRound(args) {
      check(this.userId, NonEmptyString);
      let round_prefix = RoundUrlPrefix.get();
      const url_separator = UrlSeparator.get();
      const link = (() => {
        if (round_prefix) {
        if (!round_prefix.endsWith('/')) { round_prefix += '/'; }
        return `${round_prefix}${canonical(args.name, url_separator)}`;
      }
      })();
      const r = newObject("rounds", {...args, who: this.userId}, {
        puzzles: [],
        link: args.link || link,
        sort_key: Date.now()
      }
      );
      ensureDawnOfTime(`rounds/${r._id}`);
      // This is an onduty action, so defer expiry
      Meteor.call('renewOnduty');
      // TODO(torgen): create default meta
      return r;
    },
    renameRound(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        id: NonEmptyString,
        name: NonEmptyString
      })
      );
      return renameObject("rounds", {...args, who: this.userId});
    },
      // TODO(torgen): rename default meta
    deleteRound(id) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      return deleteObject("rounds", {id, who: this.userId, condition: {puzzles: {$size: 0}}});
    },

    newPuzzle(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        round: NonEmptyString,
        feedsInto: Match.Optional([NonEmptyString]),
        puzzles: Match.Optional([NonEmptyString]),
        mechanics: Match.Optional([IsMechanic])}));
      if (Rounds.findOne(args.round) == null) { throw new Meteor.Error(404, "bad round"); }
      let puzzle_prefix = PuzzleUrlPrefix.get();
      const url_separator = UrlSeparator.get();
      const link = (() => {
        if (puzzle_prefix) {
        if (!puzzle_prefix.endsWith('/')) { puzzle_prefix += '/'; }
        return `${puzzle_prefix}${canonical(args.name, url_separator)}`;
      }
      })();
      const feedsInto = args.feedsInto || [];
      const extra = {
        solved: null,
        solved_by: null,
        drive: args.drive || null,
        spreadsheet: args.spreadsheet || null,
        doc: args.doc || null,
        link: args.link || link,
        feedsInto,
        drive_status: 'creating'
      };
      if (args.puzzles != null) {
        extra.puzzles = args.puzzles;
      }
      if (args.mechanics != null) {
        extra.mechanics = [...new Set(args.mechanics)];
      }
      const p = newObject("puzzles", {...args, who: this.userId}, extra);
      ensureDawnOfTime(`puzzles/${p._id}`);
      if (args.puzzles != null) {
        Puzzles.update({_id: {$in: args.puzzles}}, {
          $addToSet: { feedsInto: p._id
        },
          $set: {
            touched_by: p.touched_by,
            touched: p.touched
          }
        }
        , {multi: true});
      }
      if (feedsInto.length > 0) {
        Puzzles.update({_id: {$in: feedsInto}}, {
          $addToSet: { puzzles: p._id
        },
          $set: {
            touched_by: p.touched_by,
            touched: p.touched
          }
        }
        , {multi: true});
      }
      Rounds.update(args.round, {
        $addToSet: { puzzles: p._id
      },
        $set: {
          touched_by: p.touched_by,
          touched: p.touched
        }
      }
      );
      // create google drive folder (server only)
      newDriveFolder(p._id, p.name);
      // This is an onduty action, so defer expiry
      Meteor.call('renewOnduty');
      return p;
    },
    renamePuzzle(args) {
      let spreadsheet;
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        id: NonEmptyString,
        name: NonEmptyString
      })
      );
      // get drive ID (racy)
      const p = Puzzles.findOne(args.id);
      const drive = p?.drive;
      if (drive != null) { spreadsheet = p?.spreadsheet; }
      const result = renameObject("puzzles", {...args, who: this.userId});
      // rename google drive folder
      if (result && (drive != null)) { renameDriveFolder(args.name, drive, spreadsheet); }
      return result;
    },
    deletePuzzle(pid) {
      check(this.userId, NonEmptyString);
      check(pid, NonEmptyString);
      // get drive ID (racy)
      const old = Puzzles.findOne(pid);
      const now = Date.now();
      const drive = old?.drive;
      // remove puzzle itself
      const r = deleteObject("puzzles", {id: pid, who: this.userId});
      // remove from all rounds
      Rounds.update({ puzzles: pid }, {
        $pull: { puzzles: pid
      },
        $set: {
          touched: now,
          touched_by: this.userId
        }
      }
      , {multi: true});
      // Remove from all metas
      Puzzles.update({ puzzles: pid }, {
        $pull: { puzzles: pid
      },
        $set: {
          touched: now,
          touched_by: this.userId
        }
      }
      , {multi: true});
      // Remove from all feedsInto lists
      Puzzles.update({ feedsInto: pid }, {
        $pull: { feedsInto: pid
      },
        $set: {
          touched: now,
          touched_by: this.userId
        }
      }
      , {multi: true});
      // remove from events
      CalendarEvents.update({ puzzle: pid },
        {$unset: {puzzle: ''}}
      , {multi: true});
      // delete google drive folder
      if (drive != null) { deleteDriveFolder(drive); }
      // XXX: delete chat room logs?
      return r;
    },

    makeMeta(id) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const now = Date.now();
      // This only fails if, for some reason, puzzles is a list containing null.
      return 0 < Puzzles.update({_id: id, puzzles: null}, { $set: {
        puzzles: [],
        touched: now,
        touched_by: this.userId
      }
    }
      );
    },

    makeNotMeta(id) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const now = Date.now();
      return 0 < Puzzles.update({_id: id, puzzles: []}, {
        $unset: { puzzles: ""
      },
        $set: {
          touched: now,
          touched_by: this.userId
        }
      }
      );
    },

    feedMeta(puzzleId, metaId) {
      check(this.userId, NonEmptyString);
      check(puzzleId, NonEmptyString);
      check(metaId, NonEmptyString);
      if (Puzzles.findOne(metaId) == null) { throw new Meteor.Error(404, 'No such meta'); }
      if (Puzzles.findOne(puzzleId) == null) { throw new Meteor.Error(404, 'No such puzzle'); }
      const now = Date.now();
      Puzzles.update({
        _id: puzzleId,
        feedsInto: { $ne: metaId
      }
      }
      , {
        $addToSet: { feedsInto: metaId
      },
        $set: { 
          touched: now,
          touched_by: this.userId
        }
      }
      );
      return 0 < Puzzles.update({
        _id: metaId,
        puzzles: { $ne: puzzleId
      }
      }
      , {
        $addToSet: { puzzles: puzzleId
      },
        $set: { 
          touched: now,
          touched_by: this.userId
        }
      }
      );
    },

    unfeedMeta(puzzleId, metaId) {
      check(this.userId, NonEmptyString);
      check(puzzleId, NonEmptyString);
      check(metaId, NonEmptyString);
      if (Puzzles.findOne(metaId) == null) { throw new Meteor.Error(404, 'No such meta'); }
      if (Puzzles.findOne(puzzleId) == null) { throw new Meteor.Error(404, 'No such puzzle'); }
      const now = Date.now();
      Puzzles.update({
        _id: puzzleId,
        feedsInto: metaId
      }
      , {
        $pull: { feedsInto: metaId
      },
        $set: { 
          touched: now,
          touched_by: this.userId
        }
      }
      );
      return 0 < Puzzles.update({
        _id: metaId,
        puzzles: puzzleId
      }
      , {
        $pull: { puzzles: puzzleId
      },
        $set: { 
          touched: now,
          touched_by: this.userId
        }
      }
      );
    },

    newCallIn(args) {
      let backsolve, name, provided;
      check(this.userId, NonEmptyString);
      if (args.callin_type == null) { args.callin_type = callin_types.ANSWER; }
      if (args.target_type == null) { args.target_type = 'puzzles'; }
      let puzzle = null;
      let body = () => '';
      if (args.callin_type === callin_types.ANSWER) {
        check(args, {
          target: IdOrObject,
          target_type: EqualsString('puzzles'),
          answer: NonEmptyString,
          callin_type: EqualsString(callin_types.ANSWER),
          backsolve: Match.Optional(Boolean),
          provided: Match.Optional(Boolean),
          suppressRoom: Match.Optional(String)
        }
        );
        puzzle = Puzzles.findOne(args.target);
        if (puzzle == null) { throw new Meteor.Error(404, "bad target"); }
        ({
          name
        } = puzzle);
        backsolve = args.backsolve ? " [backsolved]" : '';
        provided = args.provided ? " [provided]" : '';
        body = opts => `is requesting a call-in for ${args.answer.toUpperCase()}` + 
        (opts?.specifyPuzzle ? ` (${name})` : "") + provided + backsolve;
      } else {
        check(args, {
          target: IdOrObject,
          target_type: EqualsString('puzzles'),
          answer: NonEmptyString,
          callin_type: Match.OneOf(
            EqualsString(callin_types.INTERACTION_REQUEST),
            EqualsString(callin_types.MESSAGE_TO_HQ),
            EqualsString(callin_types.EXPECTED_CALLBACK)),
          suppressRoom: Match.Optional(String)
        }
        );
        puzzle = Puzzles.findOne(args.target);
        if (puzzle == null) { throw new Meteor.Error(404, "bad target"); }
        ({
          name
        } = puzzle);
        const description = (() => { switch (args.callin_type) {
          case callin_types.INTERACTION_REQUEST:
            return 'is requesting the interaction';
          case callin_types.MESSAGE_TO_HQ:
            return 'wants to tell HQ';
          case callin_types.EXPECTED_CALLBACK:
            return 'expects HQ to call back for';
        } })();
        body = opts => `${description}, \"${args.answer.toUpperCase()}\"` + 
        (opts?.specifyPuzzle ? ` (${name})` : "");
      }
      const id = args.target._id || args.target;
      const callin = newObject("callins", {name:`${args.callin_type}:${name}:${args.answer}`, who:this.userId}, {
        callin_type: args.callin_type,
        target: id,
        target_type: args.target_type,
        answer: args.answer,
        who: this.userId,
        submitted_to_hq: false,
        backsolve: !!args.backsolve,
        provided: !!args.provided,
        status: 'pending'
      }
      , {suppressLog:true});
      const msg = {
        action: true,
        header_ignore: true,
        on_behalf: true
      };
      // send to the general chat
      msg.body = body({specifyPuzzle: true});
      if (args.suppressRoom !== "general/0") {
        Meteor.call('newMessage', msg);
      }
      if (puzzle != null) {
        // send to the puzzle chat
        msg.body = body({specifyPuzzle: false});
        msg.room_name = `puzzles/${id}`;
        if (args.suppressRoom !== msg.room_name) {
          Meteor.call('newMessage', msg);
        }
        // send to the metapuzzle chat
        puzzle.feedsInto.forEach(function(meta) {
          msg.body = body({specifyPuzzle: true});
          msg.room_name = `puzzles/${meta}`;
          if (args.suppressRoom !== msg.room_name) {
            return Meteor.call("newMessage", msg);
          }
        });
      }
      oplog(`New ${args.callin_type} ${args.answer} submitted for`, args.target_type, id, 
          this.userId, 'callins');
      return callin;
    },

    // Response is forbibben for answers and optional for other callin types.
    correctCallIn(id, response) {
      let puzzle;
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const callin = CallIns.findOne(id);
      if (!callin) { throw new Meteor.Error(400, "bad callin"); }
      let msg = {
        room_name: `${callin.target_type}/${callin.target}`,
        action: true,
        on_behalf: true
      };
      if (callin.target_type === 'puzzles') { puzzle = Puzzles.findOne(callin.target); }
      if (callin.callin_type === callin_types.ANSWER) {
        check(response, undefined);
        // call-in is cancelled as a side-effect of setAnswer
        Meteor.call("setAnswer", {
          target: callin.target,
          answer: callin.answer,
          backsolve: callin.backsolve,
          provided: callin.provided
        }
        );
        if (puzzle != null) {
          const backsolve = callin.backsolve ? "[backsolved] " : '';
          const provided = callin.provided ? "[provided] " : '';
          Object.assign(msg,
            {body: `reports that ${provided}${backsolve}${callin.answer.toUpperCase()} is CORRECT!`});
        } else {
          msg = null;
        }
      } else {
        check(response, Match.Optional(String));
        const updateBody = {
          status: 'accepted',
          resolved: Date.now()
        };
        const extra = (() => {
          if (response != null) {
          updateBody.response = response;
          return ` with response \"${response}\"`;
        } else {
          return '';
        }
        })();
        const type_text = callin.callin_type === callin_types.MESSAGE_TO_HQ ?
          'message to HQ'
        : callin.callin_type;
        const verb = callin.callin_type === callin_types.EXPECTED_CALLBACK ?
          'RECEIVED'
        : 'ACCEPTED';

        Object.assign(msg,
          {body: `reports that the ${type_text} \"${callin.answer}\" was ${verb}${extra}!`});
        CallIns.update({_id: id},
          {$set: updateBody});
      }

      if (msg != null) {

        // one message to the puzzle chat
        Meteor.call('newMessage', msg);

        // one message to the general chat
        delete msg.room_name;
        if (puzzle?.name != null) { msg.body += ` (${puzzle.name})`; }
        Meteor.call('newMessage', {...msg, header_ignore: true});

        if (callin.callin_type === callin_types.ANSWER) {
          // one message to the each metapuzzle's chat
          puzzle.feedsInto.forEach(function(meta) {
            msg.room_name = `puzzles/${meta}`;
            return Meteor.call('newMessage', msg);
          });
        }
      }
      // This is an onduty action, so defer expiry.
      return Meteor.call('renewOnduty');
    },

    // Response is forbibben for answers and optional for everything else
    incorrectCallIn(id, response) {
      let puzzle;
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const callin = CallIns.findOne(id);
      if (!callin) { throw new Meteor.Error(400, "bad callin"); }
      let msg = {
        room_name: `${callin.target_type}/${callin.target}`,
        action: true,
        on_behalf: true
      };
      if (callin.target_type === 'puzzles') { puzzle = Puzzles.findOne(callin.target); }
      if (callin.callin_type === callin_types.ANSWER) {
        check(response, undefined);
        // call-in is cancelled as a side-effect of addIncorrectAnswer
        Meteor.call("addIncorrectAnswer", {
          target: callin.target,
          answer: callin.answer,
          backsolve: callin.backsolve,
          provided: callin.provided
        }
        );
        if (puzzle != null) {
          Object.assign(msg,
            {body: `sadly relays that ${callin.answer.toUpperCase()} is INCORRECT.`});
        } else {
          msg = null;
        }
      } else if (callin.callin_type === callin_types.EXPECTED_CALLBACK) {
        throw new Meteor.Error(400, 'expected callback can\'t be incorrect');
      } else {
        check(response, Match.Optional(String));
        const updateBody = {
          status: 'rejected',
          resolved: Date.now()
        };
        const extra = (() => {
          if (response != null) {
          updateBody.response = response;
          return ` with response \"${response}\"`;
        } else {
          return '';
        }
        })();
        const type_text = callin.callin_type === callin_types.MESSAGE_TO_HQ ?
          'message to HQ'
        : callin.callin_type;

        Object.assign(msg,
          {body: `sadly relays that the ${type_text} \"${callin.answer}\" was REJECTED${extra}.`});
        CallIns.update({_id: id},
          {$set: updateBody});
      }

      if (msg != null) {
        // one message to the puzzle chat
        Meteor.call('newMessage', msg);

        if (puzzle != null) {
          // one message to the general chat
          delete msg.room_name;
          if (puzzle.name != null) { msg.body += ` (${puzzle.name})`; }
          Meteor.call('newMessage', {...msg, header_ignore: true});
          puzzle.feedsInto.forEach(function(meta) {
            msg.room_name = `puzzles/${meta}`;
            return Meteor.call('newMessage', msg);
          });
        }
      }
        
      // This is an onduty action, so defer expiry.
      return Meteor.call('renewOnduty');
    },

    cancelCallIn(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        id: NonEmptyString,
        suppressLog: Match.Optional(Boolean)
      })
      );
      const callin = CallIns.findOne(args.id);
      if (!callin) { throw new Meteor.Error(404, "bad callin"); }
      if (!args.suppressLog) {
        oplog(`Canceled call-in of ${callin.answer} for`, 'puzzles', 
            callin.target, this.userId);
      }
      return CallIns.update({_id: args.id, status: 'pending'}, {
        $set: {
          status: 'cancelled',
          resolved: Date.now()
        }
      }
      );
    },
    
    claimOnduty(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        from: OptionalKWArg(NonEmptyString)})
      );
      const now = Date.now();
      try {
        const res = Roles.upsert({_id: 'onduty', holder: args.from }, {
          holder: this.userId,
          claimed_at: now,
          renewed_at: now,
          expires_at: now + (RoleRenewalTime.get() * 60000)
        }
        );
        if (res.insertedId != null) {
          // Nobody was onduty
          return oplog('is now', 'roles', 'onduty', this.userId, 'onduty');
        } else {
          // Took it from who you thought
          return oplog(`took over from @${args.from} as`, 'roles', 'onduty', this.userId, 'onduty');
        }
      } catch (e) {
        if (isDuplicateError(e)) {
          const current = Roles.findOne('onduty');
          if (args.from != null) {
            throw new Meteor.Error(412, `Tried to take onduty from ${args.from} but it was held by ${current.holder}`);
          } else {
            throw new  Meteor.Error(412, `Tried to claim vacant onduty but it was held by ${current.holder}`);
          }
        } else { throw e; }
      }
    },

    renewOnduty() {
      check(this.userId, NonEmptyString);
      const now = Date.now();
      const count = Roles.update({_id: 'onduty', holder: this.userId}, {
        $set: {
          renewed_at: now,
          expires_at: now + (RoleRenewalTime.get() * 60000)
        }
      }
      );
      return count !== 0;
    },

    releaseOnduty() {
      check(this.userId, NonEmptyString);
      const count = Roles.remove({_id: 'onduty', holder: this.userId});
      if (count !== 0) {
        oplog('is no longer onduty', 'roles', null, this.userId, 'onduty');
      }
      return count !== 0;
    },

    // locateNick is in /server/methods

    favoriteMechanic(mechanic) {
      check(this.userId, NonEmptyString);
      check(mechanic, IsMechanic);
      const n = Meteor.users.update(this.userId, {$addToSet: {favorite_mechanics: mechanic}});
      if (n <= 0) { throw new Meteor.Error(400, `bad userId: ${this.userId}`); }
    },

    unfavoriteMechanic(mechanic) {
      check(this.userId, NonEmptyString);
      check(mechanic, IsMechanic);
      const n = Meteor.users.update(this.userId, {$pull: {favorite_mechanics: mechanic}});
      if (n <= 0) { throw new Meteor.Error(400, `bad userId: ${this.userId}`); }
    },

    deleteMessage(id) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      return Messages.update({
        _id: id,
        dawn_of_time: { $ne: true
      }
      }
      ,
        {$set: {deleted: true}});
    },

    setStarred(id, starred) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      check(starred, Boolean);
      const num = Messages.update(({
        _id: id,
        to: null,
        system: { $in: [false, null]
      },
        action: { $in: [false, null]
      },
        oplog: { $in: [false, null]
      },
        presence: null
      }), {$set: {starred: starred || null}});
      if (starred && (num > 0)) {
        // If it's in general chat, announce it if it hasn't been announced before
        Messages.update({
          _id: id,
          room_name: 'general/0',
          announced_at: null
        }
        , { $set: {
          announced_at: Date.now(),
          announced_by: this.userId
        }
      }
        );
      }
      return num;
    },

    updateLastRead(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        room_name: NonEmptyString,
        timestamp: Number
      })
      );
      const query = { 
        nick: this.userId,
        room_name: args.room_name
      };
      if (this.isSimulation) {
        query._id = args.room_name;
      }
      return LastRead.upsert(query, {$max: {timestamp: args.timestamp}});
    },

    get(type, id) {
      check(this.userId, NonEmptyString);
      check(type, NonEmptyString);
      check(id, NonEmptyString);
      return collection(type).findOne(id);
    },

    getByName(args) {
      let o, type;
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        name: NonEmptyString,
        optional_type: Match.Optional(NonEmptyString)
      })
      );
      for (type of ['rounds','puzzles']) {
        if (args.optional_type && (args.optional_type !== type)) { continue; }
        o = collection(type).findOne({canon: canonical(args.name)});
        if (o) { return {type,object:o}; }
      }
      if (!args.optional_type || (args.optional_type === 'nicks')) {
        o = Meteor.users.findOne(canonical(args.name));
        if (o) { return {type: 'nicks', object: o}; }
      }
    },

    setField(args) {
      console.log(args);
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        type: ValidType,
        object: IdOrObject,
        fields: settableFields[args.type]}));
      const id = args.object._id || args.object;
      const now = Date.now();
      args.fields.touched = now;
      args.fields.touched_by = this.userId;
      collection(args.type).update(id, {$set: args.fields});
      return true;
    },

    setTag(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        name: NonEmptyString,
        type: ValidType,
        object: IdOrObject,
        value: String
      })
      );
      // bail to setAnswer/deleteAnswer if this is the 'answer' tag.
      if (canonical(args.name) === 'answer') {
        return Meteor.call((args.value ? "setAnswer" : "deleteAnswer"), {
          type: args.type,
          target: args.object,
          answer: args.value
        }
        );
      }
      if (canonical(args.name) === 'link') {
        args.fields = { link: args.value };
        return Meteor.call('setField', args);
      }
      args.now = Date.now(); // don't let caller lie about the time
      const updateDoc = { $set: {
        touched: args.now,
        touched_by: this.userId
      }
    };
      const id = args.object._id || args.object;
      setTagInternal(updateDoc, {...args, who: this.userId});
      return 0 < collection(args.type).update(id, updateDoc);
    },

    renameTag({type, object, old_name, new_name}) {
      let ct;
      check(this.userId, NonEmptyString);
      check(type, ValidType);
      check(object, IdOrObject);
      check(old_name, NonEmptyString);
      check(new_name, NonEmptyString);
      const new_canon = canonical(new_name);
      if (new_canon === 'link') { throw new Match.Error('Can\'t rename to link'); }
      const old_canon = canonical(old_name);
      const now = Date.now();
      const coll = collection(type);
      const id = object._id || object;
      if (new_canon === old_canon) {
        // change 'name' but do nothing else
        ct = coll.update({
          _id: id,
          [`tags.${old_canon}`]: { $exists: true
        }
        }, {
          $set: {
            [`tags.${new_canon}.name`]: new_name,
            [`tags.${new_canon}.touched`]: now,
            [`tags.${new_canon}.touched_by`]: this.userId,
            touched: now,
            touched_by: this.userId
          }
        });
        if (1 !== ct) {
          throw new Meteor.Error(404, "No such object");
        }
        return; 
      }
      if (this.isSimulation) {
        // this is all synchronous
        ct = coll.update({
          _id: id,
          [`tags.${old_canon}`]: { $exists: true
        },
          [`tags.${new_canon}`]: { $exists: false
        }
        }, {
          $set: {
            [`tags.${new_canon}.name`]: new_name,
            [`tags.${new_canon}.touched`]: now,
            [`tags.${new_canon}.touched_by`]: this.userId,
            touched: now,
            touched_by: this.userId
          },
          $rename: {
            [`tags.${old_canon}.value`]: `tags.${new_canon}.value`
          }
        });
        if (ct === 1) {
          coll.update({_id: id}, {$unset: {[`tags.${old_canon}`]: ''}});
        } else { 
          throw new Meteor.Error(404, "No such object");
        }
        return;
      }
      // On the server, use aggregation pipeline to make the whole edit in a single
      // call to avoid a race condition. This requires rawCollection because the
      // wrappers don't support aggregation pipelines.
      const result = Promise.await(coll.rawCollection().updateOne({
        _id: id,
        [`tags.${old_canon}`]: { $exists: true
      },
        [`tags.${new_canon}`]: { $exists: false
      }
      }, [{
        $addFields: {
          [`tags.${new_canon}`]: {
            value: `$tags.${old_canon}.value`,
            name: { $literal: new_name
          },
            touched: now,
            touched_by: { $literal: this.userId
          }
          },
          touched: now,
          touched_by: { $literal: this.userId
        }
        }},
        {$unset: `tags.${old_canon}` }
      ]));
      if (1 === result.modifiedCount) {
        // Since we used rawCollection, we Have to trigger subscription update manually.
        return Meteor.refresh({collection: type, id});
      } else {
        throw new Meteor.Error(404, "No such object");
      }
    },

    deleteTag(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        name: NonEmptyString,
        type: ValidType,
        object: IdOrObject
      })
      );
      const id = args.object._id || args.object;
      const name = canonical(args.name);
      // bail to deleteAnswer if this is the 'answer' tag.
      if (name === 'answer') {
        return Meteor.call("deleteAnswer", {
          type: args.type,
          target: args.object
        }
        );
      }
      if (name === 'link') {
        args.fields = { link: null };
        return Meteor.call('setField', args);
      }
      args.now = Date.now(); // don't let caller lie about the time
      const updateDoc = { $set: {
        touched: args.now,
        touched_by: this.userId
      }
    };
      deleteTagInternal(updateDoc, name);
      return 0 < collection(args.type).update({_id: id, [`tags.${name}`]: {$exists: true}}, updateDoc);
    },

    summon(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        object: IdOrObject,
        how: Match.Optional(NonEmptyString)
      })
      );
      const id = args.object._id || args.object;
      const obj = Puzzles.findOne(id);
      if ((obj == null)) {
        return `Couldn't find puzzle ${id}`;
      }
      if (obj.solved) {
        return `puzzle ${obj.name} is already answered`;
      }
      const wasStuck = isStuck(obj);
      const rawhow = args.how || 'Stuck';
      const how = rawhow.toLowerCase().startsWith('stuck') ? rawhow : `Stuck: ${rawhow}`;
      Meteor.call('setTag', {
        object: id,
        type: 'puzzles',
        name: 'Status',
        value: how,
        now: Date.now()
      }
      );
      if (isStuck(obj)) {
        return;
      }
      oplog("Help requested for", 'puzzles', id, this.userId, 'stuck');
      let body = `has requested help: ${rawhow}`;
      Meteor.call('newMessage', {
        action: true,
        body,
        room_name: `puzzles/${id}`,
        on_behalf: true
      }
      );
      const objUrl = // see Router.urlFor
        Meteor._relativeToSiteRootUrl(`/puzzles/${id}`);
      const solverTimePart = (obj.solverTime != null) ?
        `; ${Math.floor(obj.solverTime / 60000)} solver-minutes`
      : '';
      body = `has requested help: ${UI._escape(rawhow)} (puzzle <a class=\"puzzles-link\" href=\"${objUrl}\">${UI._escape(obj.name)}</a>${solverTimePart})`;
      Meteor.call('newMessage', {
        action: true,
        bodyIsHtml: true,
        body,
        header_ignore: true,
        on_behalf: true
      }
      );
    },

    unsummon(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        object: IdOrObject})
      );
      const id = args.object._id || args.object;
      const obj = Puzzles.findOne(id);
      if ((obj == null)) {
        return `Couldn't find puzzle ${id}`;
      }
      if (!(isStuck(obj))) {
        return `puzzle ${obj.name} isn't stuck`;
      }
      oplog("Help request cancelled for", 'puzzles', id, this.userId);
      const sticker = obj.tags.status?.touched_by;
      Meteor.call('deleteTag', {
        object: id,
        type: 'puzzles',
        name: 'status',
        now: Date.now()
      }
      );
      let body = "has arrived to help";
      if (this.userId === sticker) {
        body = "no longer needs help getting unstuck";
      }
      Meteor.call('newMessage', {
        action: true,
        body,
        room_name: `puzzles/${id}`,
        on_behalf: true
      }
      );
      body = `${body} in puzzle ${obj.name}`;
      Meteor.call('newMessage', {
        action: true,
        body,
        header_ignore: true,
        on_behalf: true
      }
      );
    },

    getRoundForPuzzle(puzzle) {
      check(this.userId, NonEmptyString);
      check(puzzle, IdOrObject);
      const id = puzzle._id || puzzle;
      check(id, NonEmptyString);
      return Rounds.findOne({puzzles: id});
    },

    moveWithinMeta(id, parentId, args) {
      check(this.userId, NonEmptyString);
      check(args, Match.OneOf(ObjectWith({pos: Number}), ObjectWith({before: NonEmptyString}), ObjectWith({after: NonEmptyString})));
      args.who = this.userId;
      return moveWithinParent(id, 'puzzles', parentId, args);
    },

    moveWithinRound(id, parentId, args) {
      check(this.userId, NonEmptyString);
      check(args, Match.OneOf(ObjectWith({pos: Number}), ObjectWith({before: NonEmptyString}), ObjectWith({after: NonEmptyString})));
      args.who = this.userId;
      return moveWithinParent(id, 'rounds', parentId, args);
    },

    moveRound(id, dir) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const round = Rounds.findOne(id);
      let order = 1;
      let op = '$gt';
      if (dir < 0) {
        order = -1;
        op = '$lt';
      }
      const query = {};
      query[op] = round.sort_key;
      const last = Rounds.findOne({sort_key: query}, {sort: {sort_key: order}});
      if (last == null) { return; }
      Rounds.update(id, {$set: {sort_key: last.sort_key}});
      Rounds.update(last._id, {$set: {sort_key: round.sort_key}});
    },

    setAnswer(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        target: IdOrObject,
        answer: NonEmptyString,
        backsolve: Match.Optional(Boolean),
        provided: Match.Optional(Boolean)
      })
      );
      const id = args.target._id || args.target;

      // Only perform the update and oplog if the answer is changing
      const oldAnswer = Puzzles.findOne(id)?.tags.answer?.value;
      if (oldAnswer === args.answer) {
        return false;
      }
      const now = Date.now();
      // Accumulate solver time for currrent presence
      let solverTime = 0;
      Presence.find({scope: 'chat', room_name: `puzzles/${id}`, bot: {$ne: true}}).forEach(function(present) {
        const since = now - present.timestamp;
        if (since < (((PRESENCE_KEEPALIVE_MINUTES*60)+10)*1000)) {
          // If it's been less than one keepalive interval, plus some skew, since you checked in, assume you're still here
          return solverTime += since;
        } else {
          // On average you left halfway through the keepalive period.
          return solverTime += since - (PRESENCE_KEEPALIVE_MINUTES*30*1000);
        }
      });

      const updateDoc = {
        $set: {
          solved: now,
          solved_by: this.userId,
          confirmed_by: this.userId,
          touched: now,
          touched_by: this.userId
        },
        $inc: {
          solverTime
        }
      };
      const c = CallIns.findOne({target: id, callin_type: callin_types.ANSWER, answer: args.answer});
      if (c != null) {
        updateDoc.$set.solved_by = c.created_by;
      }
      setTagInternal(updateDoc, {
        name: 'Answer',
        value: args.answer,
        who: this.userId,
        now
      }
      );
      deleteTagInternal(updateDoc, 'status');
      if (args.backsolve) {
        setTagInternal(updateDoc, {
          name: 'Backsolve',
          value: 'yes',
          who: this.userId,
          now
        }
        );
      } else {
        deleteTagInternal(updateDoc, 'Backsolve');
      }
      if (args.provided) {
        setTagInternal(updateDoc, {
          name: 'Provided',
          value: 'yes',
          who: this.userId,
          now
        }
        );
      } else {
        deleteTagInternal(updateDoc, 'Provided');
      }
      const updated = Puzzles.update({
        _id: id,
        'tags.answer.value': { $ne: args.answer
      }
      }
      , updateDoc);
      if (updated === 0) { return false; }
      oplog(`Found an answer (${args.answer.toUpperCase()}) to`, 'puzzles', id, this.userId, 'answers');

      // cancel any entries on the call-in queue for this puzzle
      CallIns.update({target_type: 'puzzles', target: id, status: 'pending', callin_type: callin_types.ANSWER, answer: args.answer}, {
        $set: {
          status: 'accepted',
          resolved: now
        }
      }
      );
      CallIns.update({target_type: 'puzzles', target: id, status: 'pending'}, {
        $set: {
          status: 'cancelled',
          resolved: now
        }
      }
      ,
        {multi: true});
      return true;
    },

    addIncorrectAnswer(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        target: IdOrObject,
        answer: NonEmptyString,
        backsolve: Match.Optional(Boolean),
        provided: Match.Optional(Boolean)
      })
      );
      const id = args.target._id || args.target;
      const now = Date.now();

      const target = Puzzles.findOne(id);
      if (!target) { throw new Meteor.Error(400, "bad target"); }

      oplog(`reports incorrect answer ${args.answer} for`, 'puzzles', id, this.userId, 'callins');
      // cancel any matching entries on the call-in queue for this puzzle
      // The 'pending' status means this should be unique if present.
      CallIns.update({target_type: 'puzzles', callin_type: callin_types.ANSWER, target: id, status: 'pending', answer: args.answer}, {
        $set: {
          status: 'rejected',
          resolved: now
        }
      }
      );
      return true;
    },

    deleteAnswer(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        target: IdOrObject})
      );
      const id = args.target._id || args.target;
      const now = Date.now();
      const updateDoc = { $set: {
        solved: null,
        solved_by: null,
        confirmed_by: null,
        touched: now,
        touched_by: this.userId
      }
    };
      deleteTagInternal(updateDoc, 'answer');
      deleteTagInternal(updateDoc, 'backsolve');
      deleteTagInternal(updateDoc, 'provided');
      Puzzles.update(id, updateDoc);
      oplog("Deleted answer for", 'puzzles', id, this.userId);
      return true;
    },

    favorite(puzzle) {
      check(this.userId, NonEmptyString);
      check(puzzle, NonEmptyString);
      const num = Puzzles.update(puzzle, { $set: {
        [`favorites.${this.userId}`]: true
      }
    }
      );
      return num > 0;
    },

    unfavorite(puzzle) {
      check(this.userId, NonEmptyString);
      check(puzzle, NonEmptyString);
      const num = Puzzles.update(puzzle, { $unset: {
        [`favorites.${this.userId}`]: ''
      }
    }
      );
      return num > 0;
    },

    addMechanic(puzzle, mechanic) {
      check(this.userId, NonEmptyString);
      check(puzzle, NonEmptyString);
      check(mechanic, IsMechanic);
      const num = Puzzles.update(puzzle, {
        $addToSet: { mechanics: mechanic
      },
        $set: {
          touched: Date.now(),
          touched_by: this.userId
        }
      }
      );
      if (num <= 0) { throw new Meteor.Error(404, "bad puzzle"); }
    },

    removeMechanic(puzzle, mechanic) {
      check(this.userId, NonEmptyString);
      check(puzzle, NonEmptyString);
      check(mechanic, IsMechanic);
      const num = Puzzles.update(puzzle, {
        $pull: { mechanics: mechanic
      },
        $set: {
          touched: Date.now(),
          touched_by: this.userId
        }
      }
      );
      if (num <= 0) { throw new Meteor.Error(404, "bad puzzle"); }
    },

    newPoll(room, question, options) {
      check(this.userId, NonEmptyString);
      check(room, NonEmptyString);
      check(question, NonEmptyString);
      check(options, ArrayWithLength(NonEmptyString, {min: 2, max: 5}));
      const canonOpts = new Set;
      const opts = (() => {
        const result = [];
        for (let opt of options) {
          const copt = canonical(opt);
          if (canonOpts.has(copt)) { continue; }
          canonOpts.add(copt);
          result.push({canon: copt, option: opt});
        }
        return result;
      })();
      const id = Polls.insert({
        created: Date.now(),
        created_by: this.userId,
        question,
        options: opts,
        votes: {}});
      newMessage({
        nick: this.userId,
        body: question,
        room_name: room,
        poll: id,
        on_behalf: true
      });
      return id;
    },

    vote(poll, option) {
      check(this.userId, NonEmptyString);
      check(poll, NonEmptyString);
      check(option, NonEmptyString);
      // This atomically checks that the poll exists and the option is valid,
      // then replaces any existing vote the user made.
      return Polls.update({
        _id: poll,
        'options.canon': option
      }
      ,
        {$set: {[`votes.${this.userId}`]: {canon: option, timestamp: Date.now()}}});
    },

    setPuzzleForEvent(event, puzzle) {
      check(this.userId, NonEmptyString);
      check(event, NonEmptyString);
      check(puzzle, Match.Maybe(NonEmptyString));
      const update = (() => {
        if (puzzle != null) {
        check(Puzzles.findOne({_id: puzzle}), Object);
        return {$set: {puzzle}};
      } else {
        return {$unset: {puzzle: ''}};
      }
      })();
      return 0 < CalendarEvents.update({_id: event}, update);
    },

    addEventAttendee(event, who) {
      check(this.userId, NonEmptyString);
      check(event, NonEmptyString);
      check(Meteor.users.findOne({_id: who}), Object);
      return 0 < CalendarEvents.update({_id: event}, {$addToSet: {attendees: who}});
    },

    removeEventAttendee(event, who) {
      check(this.userId, NonEmptyString);
      check(event, NonEmptyString);
      check(Meteor.users.findOne({_id: who}), Object);
      return 0 < CalendarEvents.update({_id: event}, {$pull: {attendees: who}});
    },

    getRinghuntersFolder() {
      check(this.userId, NonEmptyString);
      if (!Meteor.isServer) { return; }
      // Return special folder used for uploads to general Ringhunters chat
      return driveEnv.get()?.ringhuntersFolder;
    },

    // if a round/puzzle folder gets accidentally deleted, this can be used to
    // manually re-create it.
    fixPuzzleFolder(args) {
      check(this.userId, NonEmptyString);
      check(args, ObjectWith({
        object: IdOrObject,
        name: NonEmptyString
      })
      );
      const id = args.object._id || args.object;
      if (0 === Puzzles.update({_id: id, drive_status: {$nin: ['creating', 'fixing']}}, {$set: {drive_status: 'fixing'}})) {
        throw new Meteor.Error('Can\'t fix this puzzle folder now');
      }
      newDriveFolder(id, args.name);
      // This is an onduty action, so defer expiry
      return Meteor.call('renewOnduty');
    }
  });
})();
