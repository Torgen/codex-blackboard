let ensureDawnOfTime, newMessage;
import { PRESENCE_KEEPALIVE_MINUTES } from "/lib/imports/constants.js";
import {
  BBCollection,
  CalendarEvents,
  CallIns,
  LastRead,
  Messages,
  Polls,
  Presence,
  Puzzles,
  Roles,
  Rounds,
  collection,
  pretty_collection,
} from "/lib/imports/collections.js";
import canonical from "./imports/canonical.js";
import isDuplicateError from "./imports/duplicate.js";
import { drive as driveEnv } from "./imports/environment.js";
import {
  ArrayWithLength,
  EqualsString,
  NonEmptyString,
  IdOrObject,
  ObjectWith,
  OptionalKWArg,
} from "./imports/match.js";
import { IsMechanic } from "./imports/mechanics.js";
import { isStuck, canonicalTags } from "./imports/tags.js";
import {
  RoundUrlPrefix,
  PuzzleUrlPrefix,
  RoleRenewalTime,
  UrlSeparator,
} from "./imports/settings.js";
import * as callin_types from "./imports/callin_types.js";
if (Meteor.isServer) {
  ({ newMessage, ensureDawnOfTime } = require("/server/imports/newMessage.js"));
} else {
  newMessage = async function () {};
  ensureDawnOfTime = async function () {};
}
// Blackboard -- data model
// Loaded on both the client and the server

(function () {
  // a key of BBCollection
  const ValidType = Match.Where(function (x) {
    check(x, NonEmptyString);
    return Object.prototype.hasOwnProperty.call(BBCollection, x);
  });

  function oplog(message, type, id, who, stream = "") {
    return Messages.insertAsync({
      room_name: "oplog/0",
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
      stream,
    });
  }

  async function newObject(type, args, extra = {}, options = {}) {
    check(
      args,
      ObjectWith({
        name: NonEmptyString,
        who: NonEmptyString,
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
      tags: canonicalTags(args.tags || [], args.who),
      ...extra,
    };
    object._id = await collection(type).insertAsync(object);
    // istanbul ignore else
    if (!options.suppressLog) {
      await oplog(
        "Added",
        type,
        object._id,
        args.who,
        ["puzzles", "rounds"].includes(type) ? "new-puzzles" : ""
      );
    }
    return object;
  }

  async function renameObject(type, args, options = {}) {
    check(
      args,
      ObjectWith({
        id: NonEmptyString,
        name: NonEmptyString,
        who: NonEmptyString,
      })
    );
    const now = Date.now();

    // Only perform the rename and oplog if the name is changing
    // XXX: This is racy with updates to findOne().name.
    if ((await collection(type).findOneAsync(args.id)).name === args.name) {
      return false;
    }

    try {
      await collection(type).updateAsync(args.id, {
        $set: {
          name: args.name,
          canon: canonical(args.name),
          touched: now,
          touched_by: canonical(args.who),
        },
      });
    } catch (error) {
      // duplicate name--bail out
      /* istanbul ignore else */
      if (isDuplicateError(error)) {
        return false;
      } else {
        throw error;
      }
    }
    // istanbul ignore else
    if (!options.suppressLog) {
      await oplog("Renamed", type, args.id, args.who);
    }
    return true;
  }

  async function deleteObject(type, args, options = {}) {
    check(type, ValidType);
    check(
      args,
      ObjectWith({
        id: NonEmptyString,
        who: NonEmptyString,
        condition: Match.Optional(Object),
      })
    );
    const condition = args.condition ?? {};
    const name = (await collection(type).findOneAsync(args.id))?.name;
    if (!name) {
      return false;
    }
    const result = await collection(type).removeAsync({
      _id: args.id,
      ...condition,
    });
    if (result === 0) {
      return false;
    }
    // istanbul ignore else
    if (!options.suppressLog) {
      await oplog(
        `Deleted ${pretty_collection(type)} ${name}`,
        type,
        null,
        args.who
      );
    }
    return true;
  }

  function setTagInternal(updateDoc, args) {
    check(
      args,
      ObjectWith({
        name: NonEmptyString,
        value: Match.Any,
        who: NonEmptyString,
        now: Number,
      })
    );
    updateDoc.$set[`tags.${canonical(args.name)}`] = {
      name: args.name,
      value: args.value,
      touched: args.now,
      touched_by: canonical(args.who),
    };
    return true;
  }

  function deleteTagInternal(updateDoc, name) {
    check(name, NonEmptyString);
    if (updateDoc.$unset == null) {
      updateDoc.$unset = {};
    }
    updateDoc.$unset[`tags.${canonical(name)}`] = "";
    return true;
  }

  async function newDriveFolder(id, name) {
    check(id, NonEmptyString);
    check(name, NonEmptyString);
    if (!Meteor.isServer) {
      return;
    }
    let res = null;
    try {
      res = (await driveEnv.get()?.createPuzzle(name)) ?? {};
      if (!res?.id) {
        res.status = "skipped";
      }
    } catch (e) {
      res = { status: "failed" };
      /* istanbul ignore else */
      if (e instanceof Error) {
        res.message = `${e.name}: ${e.message}`;
      } else {
        res.message = `${e}`;
      }
    }
    await Puzzles.updateAsync(id, {
      $set: {
        drive_status: res.status ?? null,
        drive_error_message: res.message,
        drive: res.id,
        spreadsheet: res.spreadId,
      },
    });
  }

  async function renameDriveFolder(new_name, drive, spreadsheet) {
    check(new_name, NonEmptyString);
    check(drive, NonEmptyString);
    check(spreadsheet, Match.Optional(NonEmptyString));
    if (!Meteor.isServer) {
      return;
    }
    return await driveEnv.get()?.renamePuzzle(new_name, drive, spreadsheet);
  }

  async function deleteDriveFolder(drive) {
    check(drive, NonEmptyString);
    if (!Meteor.isServer) {
      return;
    }
    return await driveEnv.get()?.deletePuzzle(drive);
  }

  async function defaultUrl(prefixSetting, name) {
    let prefix = await prefixSetting.get();
    if (prefix) {
      if (!prefix.endsWith("/")) {
        prefix += "/";
      }
      return `${prefix}${canonical(name, await UrlSeparator.get())}`;
    }
  }

  const moveWithinParent = Meteor.isServer
    ? require("/server/imports/move_within_parent.js").default
    : require("/client/imports/move_within_parent.js").default;

  const settableFields = {
    callins: {
      callin_type: OptionalKWArg(callin_types.IsCallinType),
      submitted_by: OptionalKWArg(NonEmptyString),
      submitted_to_hq: OptionalKWArg(Boolean),
    },
    puzzles: {
      link: OptionalKWArg(String),
      order_by: Match.Optional(
        Match.OneOf(EqualsString(""), EqualsString("name"))
      ),
    },
    rounds: {
      link: OptionalKWArg(String),
    },
  };

  async function setAnswerInternal(call, puzzle, answer, backsolve, provided) {
    // Only perform the update and oplog if the answer is changing
    const oldAnswer = puzzle.tags?.answer?.value;
    if (oldAnswer === answer) {
      return false;
    }
    const now = Date.now();

    const updateDoc = {
      $set: {
        solved: now,
        solved_by: call.userId,
        confirmed_by: call.userId,
        touched: now,
        touched_by: call.userId,
      },
    };
    const c = await CallIns.findOneAsync({
      target_type: "puzzles",
      target: puzzle._id,
      callin_type: {
        $in: [callin_types.ANSWER, callin_types.PARTIAL_ANSWER],
      },
      answer,
    });
    if (c != null) {
      updateDoc.$set.solved_by = c.created_by;
    }
    setTagInternal(updateDoc, {
      name: "Answer",
      value: answer,
      who: call.userId,
      now,
    });
    deleteTagInternal(updateDoc, "status");
    if (backsolve) {
      setTagInternal(updateDoc, {
        name: "Backsolve",
        value: "yes",
        who: call.userId,
        now,
      });
    } else {
      deleteTagInternal(updateDoc, "Backsolve");
    }
    if (provided) {
      setTagInternal(updateDoc, {
        name: "Provided",
        value: "yes",
        who: call.userId,
        now,
      });
    } else {
      deleteTagInternal(updateDoc, "Provided");
    }
    const updated = await Puzzles.updateAsync(
      {
        _id: puzzle._id,
        "tags.answer.value": { $ne: answer },
      },
      updateDoc
    );
    if (updated === 0) {
      return false;
    }
    await oplog(
      `Found an answer (${answer.toUpperCase()}) to`,
      "puzzles",
      puzzle._id,
      call.userId,
      "answers"
    );
    // Set this answer to accepted.
    await CallIns.updateAsync(
      {
        target_type: "puzzles",
        target: puzzle._id,
        status: "pending",
        callin_type: {
          $in: [callin_types.ANSWER, callin_types.PARTIAL_ANSWER],
        },
        answer: answer,
      },
      {
        $set: {
          status: "accepted",
          resolved: now,
          callin_type: callin_types.ANSWER,
        },
      }
    );
    // cancel any entries on the call-in queue for this puzzle
    await CallIns.updateAsync(
      { target_type: "puzzles", target: puzzle._id, status: "pending" },
      {
        $set: {
          status: "cancelled",
          resolved: now,
        },
      },
      { multi: true }
    );
    return true;
  }

  async function recentSolverTime(id) {
    let solverTime = 0;
    const now = Date.now();
    await Presence.find({
      scope: "chat",
      room_name: `puzzles/${id}`,
      bot: { $ne: true },
    }).forEachAsync(function (present) {
      const since = now - present.timestamp;
      if (since < (PRESENCE_KEEPALIVE_MINUTES * 60 + 10) * 1000) {
        // If it's been less than one keepalive interval, plus some skew, since you checked in, assume you're still here
        return (solverTime += since);
      } else {
        // On average you left halfway through the keepalive period.
        return (solverTime += since - PRESENCE_KEEPALIVE_MINUTES * 30 * 1000);
      }
    });
    await Puzzles.updateAsync(id, { $inc: { solverTime } });
  }

  Meteor.methods({
    async newRound(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          name: NonEmptyString,
          link: Match.Optional(NonEmptyString),
          createPlaceholder: Match.Optional(Boolean),
        })
      );
      const link = args.link || (await defaultUrl(RoundUrlPrefix, args.name));
      const r = await newObject(
        "rounds",
        { ...args, who: this.userId },
        {
          puzzles: [],
          link: link,
          sort_key: Date.now(),
        }
      );
      await ensureDawnOfTime(`rounds/${r._id}`);
      if (args.createPlaceholder) {
        // this will renew onduty
        const p = await Meteor.callAsync("newPuzzle", {
          name: `${args.name} Placeholder`,
          round: r._id,
          puzzles: [],
        });
        r.puzzles.push(p._id);
      } else {
        // This is an onduty action, so defer expiry
        await Meteor.callAsync("renewOnduty");
      }
      return r;
    },
    async renameRound(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          id: NonEmptyString,
          name: NonEmptyString,
        })
      );
      return await renameObject("rounds", { ...args, who: this.userId });
    },
    async deleteRound(id) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      return await deleteObject("rounds", {
        id,
        who: this.userId,
        condition: { puzzles: { $size: 0 } },
      });
    },

    async newPuzzle(args) {
      check(this.userId, NonEmptyString);
      check(args, {
        name: NonEmptyString,
        round: NonEmptyString,
        link: Match.Optional(NonEmptyString),
        feedsInto: Match.Optional([NonEmptyString]),
        puzzles: Match.Optional([NonEmptyString]),
        mechanics: Match.Optional([IsMechanic]),
        tags: Match.Optional([{ name: NonEmptyString, value: String }]),
      });
      const p = await Mongo.withTransaction(async () => {
        const link =
          args.link || (await defaultUrl(PuzzleUrlPrefix, args.name));
        const feedsInto = [...new Set(args.feedsInto || [])];
        const extra = {
          solved: null,
          solved_by: null,
          drive: null,
          spreadsheet: null,
          doc: null,
          link: link,
          feedsInto,
          drive_status: "creating",
        };
        if (args.puzzles != null) {
          extra.puzzles = [...new Set(args.puzzles)];
        }
        if (args.mechanics != null) {
          extra.mechanics = [...new Set(args.mechanics)];
        }
        const p = await newObject(
          "puzzles",
          { ...args, who: this.userId },
          extra
        );
        if (
          1 !==
          (await Rounds.updateAsync(args.round, {
            $addToSet: { puzzles: p._id },
            $set: {
              touched_by: p.touched_by,
              touched: p.touched,
            },
          }))
        ) {
          throw new Meteor.Error(404, "bad round");
        }
        if (extra.puzzles?.length > 0) {
          const updated = await Puzzles.updateAsync(
            { _id: { $in: extra.puzzles } },
            {
              $addToSet: { feedsInto: p._id },
              $set: {
                touched_by: p.touched_by,
                touched: p.touched,
              },
            },
            { multi: true }
          );
          if (updated != extra.puzzles.length) {
            throw new Meteor.Error(400, "bad feeder");
          }
        }
        if (feedsInto.length > 0) {
          const updated = await Puzzles.updateAsync(
            { _id: { $in: feedsInto } },
            {
              $addToSet: { puzzles: p._id },
              $set: {
                touched_by: p.touched_by,
                touched: p.touched,
              },
            },
            { multi: true }
          );
          if (updated != feedsInto.length) {
            throw new Meteor.Error(400, "bad meta");
          }
        }
        return p;
      });
      await ensureDawnOfTime(`puzzles/${p._id}`);
      // create google drive folder (server only)
      await newDriveFolder(p._id, p.name);
      // This is an onduty action, so defer expiry
      await Meteor.callAsync("renewOnduty");
      return p;
    },
    async renamePuzzle(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          id: NonEmptyString,
          name: NonEmptyString,
        })
      );
      try {
        const { drive, spreadsheet } = await Mongo.withTransaction(async () => {
          // get drive ID
          const p = await Puzzles.findOneAsync(args.id);
          const drive = p?.drive;
          const spreadsheet = drive ? p?.spreadsheet : null;
          const result = await renameObject("puzzles", {
            ...args,
            who: this.userId,
          });
          if (!result) {
            throw new Error("couldn't rename");
          }
          return { drive, spreadsheet };
        });
        // rename google drive folder
        if (drive != null) {
          await renameDriveFolder(args.name, drive, spreadsheet);
        }
        return true;
      } catch (error) {
        if (error.message === "couldn't rename") {
          return false;
        }
        throw error;
      }
    },
    async deletePuzzle(pid) {
      check(this.userId, NonEmptyString);
      check(pid, NonEmptyString);
      const { r, drive } = await Mongo.withTransaction(async () => {
        // get drive ID
        const old = await Puzzles.findOneAsync(pid);
        const now = Date.now();
        const drive = old?.drive;
        // remove puzzle itself
        const r = await deleteObject("puzzles", { id: pid, who: this.userId });
        // remove from all rounds
        await Rounds.updateAsync(
          { puzzles: pid },
          {
            $pull: { puzzles: pid },
            $set: {
              touched: now,
              touched_by: this.userId,
            },
          },
          { multi: true }
        );
        // Remove from all metas
        await Puzzles.updateAsync(
          { puzzles: pid },
          {
            $pull: { puzzles: pid },
            $set: {
              touched: now,
              touched_by: this.userId,
            },
          },
          { multi: true }
        );
        // Remove from all feedsInto lists
        await Puzzles.updateAsync(
          { feedsInto: pid },
          {
            $pull: { feedsInto: pid },
            $set: {
              touched: now,
              touched_by: this.userId,
            },
          },
          { multi: true }
        );
        // remove from events
        await CalendarEvents.updateAsync(
          { puzzle: pid },
          { $unset: { puzzle: "" } },
          { multi: true }
        );
        return { r, drive };
      });
      // delete google drive folder
      if (drive != null) {
        await deleteDriveFolder(drive);
      }
      // XXX: delete chat room logs?
      return r;
    },

    async makeMeta(id) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const now = Date.now();
      // This only fails if, for some reason, puzzles is a list containing null.
      return (
        0 <
        (await Puzzles.updateAsync(
          { _id: id, puzzles: null },
          {
            $set: {
              puzzles: [],
              touched: now,
              touched_by: this.userId,
            },
          }
        ))
      );
    },

    async makeNotMeta(id) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const now = Date.now();
      return (
        0 <
        (await Puzzles.updateAsync(
          { _id: id, puzzles: [] },
          {
            $unset: { puzzles: "" },
            $set: {
              touched: now,
              touched_by: this.userId,
            },
          }
        ))
      );
    },

    async feedMeta(puzzleId, metaId) {
      check(this.userId, NonEmptyString);
      check(puzzleId, NonEmptyString);
      check(metaId, NonEmptyString);
      return await Mongo.withTransaction(async () => {
        if ((await Puzzles.findOneAsync(metaId)) == null) {
          throw new Meteor.Error(404, "No such meta");
        }
        if ((await Puzzles.findOneAsync(puzzleId)) == null) {
          throw new Meteor.Error(404, "No such puzzle");
        }
        const now = Date.now();
        await Puzzles.updateAsync(
          {
            _id: puzzleId,
            feedsInto: { $ne: metaId },
          },
          {
            $addToSet: { feedsInto: metaId },
            $set: {
              touched: now,
              touched_by: this.userId,
            },
          }
        );
        return (
          0 <
          (await Puzzles.updateAsync(
            {
              _id: metaId,
              puzzles: { $ne: puzzleId },
            },
            {
              $addToSet: { puzzles: puzzleId },
              $set: {
                touched: now,
                touched_by: this.userId,
              },
            }
          ))
        );
      });
    },

    async unfeedMeta(puzzleId, metaId) {
      check(this.userId, NonEmptyString);
      check(puzzleId, NonEmptyString);
      check(metaId, NonEmptyString);
      return await Mongo.withTransaction(async () => {
        if ((await Puzzles.findOneAsync(metaId)) == null) {
          throw new Meteor.Error(404, "No such meta");
        }
        if ((await Puzzles.findOneAsync(puzzleId)) == null) {
          throw new Meteor.Error(404, "No such puzzle");
        }
        const now = Date.now();
        await Puzzles.updateAsync(
          {
            _id: puzzleId,
            feedsInto: metaId,
          },
          {
            $pull: { feedsInto: metaId },
            $set: {
              touched: now,
              touched_by: this.userId,
            },
          }
        );
        return (
          0 <
          (await Puzzles.updateAsync(
            {
              _id: metaId,
              puzzles: puzzleId,
            },
            {
              $pull: { puzzles: puzzleId },
              $set: {
                touched: now,
                touched_by: this.userId,
              },
            }
          ))
        );
      });
    },

    async newCallIn(args) {
      let backsolve, name, provided;
      check(this.userId, NonEmptyString);
      if (args.callin_type == null) {
        args.callin_type = callin_types.ANSWER;
      }
      if (args.target_type == null) {
        args.target_type = "puzzles";
      }
      let puzzle = null;
      let body = () => "";
      if (
        args.callin_type === callin_types.ANSWER ||
        args.callin_type === callin_types.PARTIAL_ANSWER
      ) {
        check(args, {
          target: IdOrObject,
          target_type: EqualsString("puzzles"),
          answer: NonEmptyString,
          callin_type: Match.OneOf(
            EqualsString(callin_types.ANSWER),
            EqualsString(callin_types.PARTIAL_ANSWER)
          ),
          backsolve: Match.Optional(Boolean),
          provided: Match.Optional(Boolean),
          suppressRoom: Match.Optional(String),
        });
        puzzle = await Puzzles.findOneAsync(args.target);
        if (puzzle == null) {
          throw new Meteor.Error(404, "bad target");
        }
        ({ name } = puzzle);
        backsolve = args.backsolve ? " [backsolved]" : "";
        provided = args.provided ? " [provided]" : "";
        body = (opts) =>
          `is requesting a call-in for ${args.answer.toUpperCase()}` +
          (opts?.specifyPuzzle ? ` (#puzzles/${puzzle._id})` : "") +
          provided +
          backsolve;
      } else {
        check(args, {
          target: IdOrObject,
          target_type: EqualsString("puzzles"),
          answer: NonEmptyString,
          callin_type: Match.OneOf(
            EqualsString(callin_types.INTERACTION_REQUEST),
            EqualsString(callin_types.MESSAGE_TO_HQ),
            EqualsString(callin_types.EXPECTED_CALLBACK)
          ),
          suppressRoom: Match.Optional(String),
        });
        puzzle = await Puzzles.findOneAsync(args.target);
        if (puzzle == null) {
          throw new Meteor.Error(404, "bad target");
        }
        ({ name } = puzzle);
        const description = (() => {
          switch (args.callin_type) {
            case callin_types.INTERACTION_REQUEST:
              return "is requesting the interaction";
            case callin_types.MESSAGE_TO_HQ:
              return "wants to tell HQ";
            case callin_types.EXPECTED_CALLBACK:
              return "expects HQ to call back for";
          }
        })();
        body = (opts) =>
          `${description}, \"${args.answer.toUpperCase()}\"` +
          (opts?.specifyPuzzle ? ` (#puzzles/${puzzle._id})` : "");
      }
      const id = args.target._id || args.target;
      const callin = await newObject(
        "callins",
        {
          name: `${args.callin_type}:${name}:${args.answer}`,
          who: this.userId,
        },
        {
          callin_type: args.callin_type,
          target: id,
          target_type: args.target_type,
          answer: args.answer,
          who: this.userId,
          submitted_to_hq: false,
          backsolve: !!args.backsolve,
          provided: !!args.provided,
          status: "pending",
        },
        { suppressLog: true }
      );
      const msg = {
        action: true,
        header_ignore: true,
        on_behalf: true,
      };
      // send to the general chat
      msg.body = body({ specifyPuzzle: true });
      if (args.suppressRoom !== "general/0") {
        await Meteor.callAsync("newMessage", msg);
      }
      if (puzzle != null) {
        // send to the puzzle chat
        msg.body = body({ specifyPuzzle: false });
        msg.room_name = `puzzles/${id}`;
        if (args.suppressRoom !== msg.room_name) {
          await Meteor.callAsync("newMessage", msg);
        }
        // send to the metapuzzle chat
        await Promise.all(
          puzzle.feedsInto.map(async function (meta) {
            msg.body = body({ specifyPuzzle: true });
            msg.room_name = `puzzles/${meta}`;
            if (args.suppressRoom !== msg.room_name) {
              await Meteor.callAsync("newMessage", msg);
            }
          })
        );
      }
      await oplog(
        `New ${args.callin_type} ${args.answer} submitted for`,
        args.target_type,
        id,
        this.userId,
        "callins"
      );
      return callin;
    },

    // Response is forbidden for answers, mandatory boolean (meaning is this
    // the last one) for partial answers,  and optional for other callin types.
    async correctCallIn(id, response) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const { callin, msg, puzzle, solved } = await Mongo.withTransaction(
        async () => {
          const callin = await CallIns.findOneAsync(id);
          if (!callin) {
            throw new Meteor.Error(400, "bad callin");
          }
          const backsolve = callin.backsolve ? "[backsolved] " : "";
          const provided = callin.provided ? "[provided] " : "";
          let msg = {
            room_name: `${callin.target_type}/${callin.target}`,
            action: true,
            on_behalf: true,
          };
          let puzzle;
          let solved = false;
          if (callin.target_type === "puzzles") {
            puzzle = await Puzzles.findOneAsync(callin.target, {
              fields: {
                answers: 1,
                feedsInto: 1,
                puzzles: 1,
                "tags.answer": 1,
              },
            });
          }
          if (callin.callin_type === callin_types.PARTIAL_ANSWER) {
            check(response, Boolean);
            check(puzzle, Object);
            if (response) {
              if (puzzle.answers) {
                const now = Date.now();
                const updateDoc = {
                  $set: {
                    solved: Date.now(),
                    solved_by: callin.created_by,
                    confirmed_by: this.userId,
                    touched: now,
                    touched_by: this.userId,
                    last_partial_answer: now,
                  },
                  $push: {
                    answers: callin.answer,
                  },
                };
                puzzle.answers.push(callin.answer);
                puzzle.answers.sort();
                setTagInternal(updateDoc, {
                  name: "Answer",
                  value: puzzle.answers.join("; "),
                  who: this.userId,
                  now,
                });
                await CallIns.updateAsync(
                  { _id: id },
                  { $set: { status: "accepted", resolved: now } }
                );
                await Puzzles.updateAsync({ _id: puzzle._id }, updateDoc);
                Object.assign(msg, {
                  body: `reports that ${provided}${backsolve}${callin.answer.toUpperCase()} is the final CORRECT answer!`,
                });
                await oplog(
                  `Found the final answer (${callin.answer.toUpperCase()}) to`,
                  "puzzles",
                  puzzle._id,
                  this.userId,
                  "answers"
                );
                solved = true;
              } else {
                // If the first partial answer is the final one, treat it as a regular answer.
                callin.callin_type = callin_types.ANSWER;
                response = undefined;
              }
            } else {
              const now = Date.now();
              const updateDoc = {
                $set: {
                  touched: now,
                  touched_by: this.userId,
                  last_partial_answer: now,
                },
                $push: {
                  answers: callin.answer,
                },
              };
              await CallIns.updateAsync(
                { _id: id },
                { $set: { status: "accepted", resolved: now } }
              );
              await Puzzles.updateAsync({ _id: puzzle._id }, updateDoc);
              Object.assign(msg, {
                body: `reports that ${provided}${backsolve}${callin.answer.toUpperCase()} is one of several CORRECT answers!`,
              });
              await oplog(
                `Found one of several answers (${callin.answer.toUpperCase()}) to`,
                "puzzles",
                puzzle._id,
                this.userId,
                "answers"
              );
            }
          }
          if (callin.callin_type === callin_types.ANSWER) {
            check(response, undefined);
            check(puzzle, Object);
            // call-in is cancelled as a side-effect of setAnswer
            await setAnswerInternal(
              this,
              puzzle,
              callin.answer,
              callin.backsolve,
              callin.provided
            );
            Object.assign(msg, {
              body: `reports that ${provided}${backsolve}${callin.answer.toUpperCase()} is CORRECT!`,
            });
            solved = true;
          } else if (callin.callin_type !== callin_types.PARTIAL_ANSWER) {
            check(response, Match.Optional(String));
            const updateBody = {
              status: "accepted",
              resolved: Date.now(),
            };
            const extra = (() => {
              if (response != null) {
                updateBody.response = response;
                return ` with response \"${response}\"`;
              } else {
                return "";
              }
            })();
            const type_text =
              callin.callin_type === callin_types.MESSAGE_TO_HQ
                ? "message to HQ"
                : callin.callin_type;
            const verb =
              callin.callin_type === callin_types.EXPECTED_CALLBACK
                ? "RECEIVED"
                : "ACCEPTED";

            Object.assign(msg, {
              body: `reports that the ${type_text} \"${callin.answer}\" was ${verb}${extra}!`,
            });
            await CallIns.updateAsync({ _id: id }, { $set: updateBody });
          }
          return { callin, solved, puzzle, msg };
        }
      );

      if (msg != null) {
        // one message to the puzzle chat
        await Meteor.callAsync("newMessage", msg);

        // one message to the general chat
        delete msg.room_name;
        msg.body += ` (#puzzles/${puzzle._id})`;
        await Meteor.callAsync("newMessage", { ...msg, header_ignore: true });

        if (
          callin.callin_type === callin_types.ANSWER ||
          callin.callin_type === callin_types.PARTIAL_ANSWER
        ) {
          // one message to each metapuzzle's chat
          for (const meta of puzzle.feedsInto) {
            msg.room_name = `puzzles/${meta}`;
            await Meteor.callAsync("newMessage", msg);
          }
        }

        // one message to each feeder's chat
        if (solved && puzzle.puzzles) {
          for (const feeder of puzzle.puzzles) {
            msg.room_name = `puzzles/${feeder}`;
            await Meteor.callAsync("newMessage", msg);
          }
        }
      }

      // Add up solver time outside transaction.
      if (solved) {
        await recentSolverTime(id);
      }

      // This is an onduty action, so defer expiry.
      await Meteor.callAsync("renewOnduty");
    },

    // Response is forbibben for answers and optional for everything else
    async incorrectCallIn(id, response) {
      let puzzle;
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const callin = await CallIns.findOneAsync(id);
      if (!callin) {
        throw new Meteor.Error(400, "bad callin");
      }
      const now = Date.now();
      let msg = {
        room_name: `${callin.target_type}/${callin.target}`,
        action: true,
        on_behalf: true,
      };
      if (callin.target_type === "puzzles") {
        puzzle = await Puzzles.findOneAsync(callin.target);
      }
      if (callin.callin_type === callin_types.EXPECTED_CALLBACK) {
        throw new Meteor.Error(400, "expected callback can't be incorrect");
      } else {
        const updateBody = {
          status: "rejected",
          resolved: now,
        };
        if (
          callin.callin_type === callin_types.ANSWER ||
          callin.callin_type === callin_types.PARTIAL_ANSWER
        ) {
          check(response, undefined);

          await oplog(
            `reports incorrect answer ${callin.answer} for`,
            "puzzles",
            callin.target,
            this.userId,
            "callins"
          );
          if (puzzle != null) {
            Object.assign(msg, {
              body: `sadly relays that ${callin.answer.toUpperCase()} is INCORRECT.`,
            });
          } else {
            msg = null;
          }
        } else {
          check(response, Match.Optional(String));
          const extra = (() => {
            if (response != null) {
              updateBody.response = response;
              return ` with response \"${response}\"`;
            } else {
              return "";
            }
          })();
          const type_text =
            callin.callin_type === callin_types.MESSAGE_TO_HQ
              ? "message to HQ"
              : callin.callin_type;

          Object.assign(msg, {
            body: `sadly relays that the ${type_text} \"${callin.answer}\" was REJECTED${extra}.`,
          });
        }
        await CallIns.updateAsync({ _id: id }, { $set: updateBody });
      }

      if (msg != null) {
        // one message to the puzzle chat
        await Meteor.callAsync("newMessage", msg);

        if (puzzle != null) {
          // one message to the general chat
          delete msg.room_name;
          msg.body += ` (#puzzles/${puzzle._id})`;
          await Meteor.callAsync("newMessage", { ...msg, header_ignore: true });
          for (const meta in puzzle.feedsInto) {
            msg.room_name = `puzzles/${meta}`;
            await Meteor.callAsync("newMessage", msg);
          }
        }
      }

      // This is an onduty action, so defer expiry.
      await Meteor.callAsync("renewOnduty");
    },

    async cancelCallIn(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          id: NonEmptyString,
          suppressLog: Match.Optional(Boolean),
        })
      );
      const callin = await CallIns.findOneAsync(args.id);
      if (!callin) {
        throw new Meteor.Error(404, "bad callin");
      }
      // istanbul ignore else
      if (!args.suppressLog) {
        await oplog(
          `Canceled call-in of ${callin.answer} for`,
          "puzzles",
          callin.target,
          this.userId
        );
      }
      await CallIns.updateAsync(
        { _id: args.id, status: "pending" },
        {
          $set: {
            status: "cancelled",
            resolved: Date.now(),
          },
        }
      );
    },

    async claimOnduty(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          from: OptionalKWArg(NonEmptyString),
        })
      );
      const now = Date.now();
      try {
        const res = await Roles.upsertAsync(
          { _id: "onduty", holder: args.from },
          {
            holder: this.userId,
            claimed_at: now,
            renewed_at: now,
            expires_at: now + (await RoleRenewalTime.get()) * 60000,
          }
        );
        if (res.insertedId != null) {
          // Nobody was onduty
          await oplog("is now", "roles", "onduty", this.userId, "onduty");
        } else {
          // Took it from who you thought
          await oplog(
            `took over from @${args.from} as`,
            "roles",
            "onduty",
            this.userId,
            "onduty"
          );
        }
      } catch (e) {
        /* istanbul ignore else */
        if (isDuplicateError(e)) {
          const current = await Roles.findOneAsync("onduty");
          if (args.from != null) {
            throw new Meteor.Error(
              412,
              `Tried to take onduty from ${args.from} but it was held by ${current.holder}`
            );
          } else {
            throw new Meteor.Error(
              412,
              `Tried to claim vacant onduty but it was held by ${current.holder}`
            );
          }
        } else {
          throw e;
        }
      }
    },

    async renewOnduty() {
      check(this.userId, NonEmptyString);
      const now = Date.now();
      const count = await Roles.updateAsync(
        { _id: "onduty", holder: this.userId },
        {
          $set: {
            renewed_at: now,
            expires_at: now + (await RoleRenewalTime.get()) * 60000,
          },
        }
      );
      return count !== 0;
    },

    async releaseOnduty() {
      check(this.userId, NonEmptyString);
      const count = await Roles.removeAsync({
        _id: "onduty",
        holder: this.userId,
      });
      if (count !== 0) {
        await oplog(
          "is no longer onduty",
          "roles",
          null,
          this.userId,
          "onduty"
        );
      }
      return count !== 0;
    },

    // locateNick is in /server/methods

    async favoriteMechanic(mechanic) {
      check(this.userId, NonEmptyString);
      check(mechanic, IsMechanic);
      const n = await Meteor.users.updateAsync(this.userId, {
        $addToSet: { favorite_mechanics: mechanic },
      });
      if (n <= 0) {
        throw new Meteor.Error(400, `bad userId: ${this.userId}`);
      }
    },

    async unfavoriteMechanic(mechanic) {
      check(this.userId, NonEmptyString);
      check(mechanic, IsMechanic);
      const n = await Meteor.users.updateAsync(this.userId, {
        $pull: { favorite_mechanics: mechanic },
      });
      if (n <= 0) {
        throw new Meteor.Error(400, `bad userId: ${this.userId}`);
      }
    },

    async deleteMessage(id) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      return await Messages.updateAsync(
        {
          _id: id,
          dawn_of_time: { $ne: true },
        },
        { $set: { deleted: true } }
      );
    },

    async setStarred(id, starred) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      check(starred, Boolean);
      const num = await Messages.updateAsync(
        {
          _id: id,
          to: null,
          system: { $in: [false, null] },
          action: { $in: [false, null] },
          oplog: { $in: [false, null] },
          presence: null,
        },
        { $set: { starred: starred || null } }
      );
      if (starred && num > 0) {
        // If it's in general chat, announce it if it hasn't been announced before
        await Messages.updateAsync(
          {
            _id: id,
            room_name: "general/0",
            announced_at: null,
          },
          {
            $set: {
              announced_at: Date.now(),
              announced_by: this.userId,
            },
          }
        );
      }
      return num;
    },

    async updateLastRead(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          room_name: NonEmptyString,
          timestamp: Number,
        })
      );
      const query = {
        nick: this.userId,
        room_name: args.room_name,
      };
      if (this.isSimulation) {
        query._id = args.room_name;
      }
      return await LastRead.upsertAsync(query, {
        $max: { timestamp: args.timestamp },
      });
    },

    async get(type, id) {
      check(this.userId, NonEmptyString);
      check(type, NonEmptyString);
      check(id, NonEmptyString);
      return await collection(type).findOneAsync(id);
    },

    async getByName(args) {
      let o, type;
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          name: NonEmptyString,
          optional_type: Match.Optional(NonEmptyString),
        })
      );
      for (type of ["rounds", "puzzles"]) {
        if (args.optional_type && args.optional_type !== type) {
          continue;
        }
        o = await collection(type).findOneAsync({
          canon: canonical(args.name),
        });
        if (o) {
          return { type, object: o };
        }
      }
      if (!args.optional_type || args.optional_type === "nicks") {
        o = await Meteor.users.findOneAsync(canonical(args.name));
        if (o) {
          return { type: "nicks", object: o };
        }
      }
    },

    async setField(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          type: ValidType,
          object: IdOrObject,
          fields: settableFields[args.type],
        })
      );
      const id = args.object._id || args.object;
      const now = Date.now();
      args.fields.touched = now;
      args.fields.touched_by = this.userId;
      await collection(args.type).updateAsync(id, { $set: args.fields });
      return true;
    },

    async setTag(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          name: NonEmptyString,
          type: ValidType,
          object: IdOrObject,
          value: String,
        })
      );
      // bail to setAnswer/deleteAnswer if this is the 'answer' tag.
      if (canonical(args.name) === "answer") {
        return await Meteor.callAsync(
          args.value ? "setAnswer" : "deleteAnswer",
          {
            type: args.type,
            target: args.object,
            answer: args.value,
          }
        );
      }
      if (canonical(args.name) === "link") {
        args.fields = { link: args.value };
        return await Meteor.callAsync("setField", args);
      }
      args.now = Date.now(); // don't let caller lie about the time
      const updateDoc = {
        $set: {
          touched: args.now,
          touched_by: this.userId,
        },
      };
      const id = args.object._id || args.object;
      setTagInternal(updateDoc, { ...args, who: this.userId });
      const result =
        0 < (await collection(args.type).updateAsync(id, updateDoc));
      if (result && args.type === "puzzles") {
        if (canonical(args.name).startsWith("meta_")) {
          const meta = await Puzzles.findOneAsync(id, {
            fields: { name: 1, puzzles: 1 },
          });
          if (meta) {
            await Promise.all(
              meta.puzzles?.map(async (feeder) => {
                await Meteor.callAsync("newMessage", {
                  action: true,
                  room_name: `puzzles/${feeder}`,
                  on_behalf: true,
                  body: `has set the ${args.name} of ${meta.name} to "${args.value}".`,
                });
              })
            );
          }
        } else if (canonical(args.name) === "cares_about") {
          const meta = await Puzzles.findOneAsync(id, {
            fields: { name: 1, puzzles: 1 },
          });
          if (meta?.puzzles) {
            await Promise.all(
              meta.puzzles.map(async (feeder_id) => {
                const feeder = await Puzzles.findOneAsync(feeder_id, {
                  fields: { tags: 1 },
                });
                if (!feeder) {
                  return;
                }
                const cares = new Map();
                args.value.split(",").forEach((tag) => {
                  cares.set(canonical(tag), tag);
                });
                let needed = [];
                cares.forEach((pretty, canon) => {
                  if (!feeder.tags?.[canon]) {
                    needed.push(pretty);
                  }
                });
                let res;
                switch (needed.length) {
                  case 0:
                    return;
                  case 1:
                    res = `"${needed[0]}" tag`;
                    break;
                  case 2:
                    res = `"${needed[0]}" and "${needed[1]}" tags`;
                    break;
                  default:
                    needed = needed.map((x) => `"${x}"`);
                    needed.push(`and ${needed.pop()}`);
                    res = needed.join(", ") + " tags";
                }
                await Meteor.callAsync("newMessage", {
                  action: true,
                  room_name: `puzzles/${feeder_id}`,
                  on_behalf: true,
                  body: `would like the ${res} set for ${meta.name}.`,
                });
              })
            );
          }
        }
      }
      return result;
    },

    async renameTag({ type, object, old_name, new_name }) {
      let ct;
      check(this.userId, NonEmptyString);
      check(type, ValidType);
      check(object, IdOrObject);
      check(old_name, NonEmptyString);
      check(new_name, NonEmptyString);
      const new_canon = canonical(new_name);
      if (new_canon === "link") {
        throw new Match.Error("Can't rename to link");
      }
      const old_canon = canonical(old_name);
      const now = Date.now();
      const coll = collection(type);
      const id = object._id || object;
      if (new_canon === old_canon) {
        // change 'name' but do nothing else
        ct = await coll.updateAsync(
          {
            _id: id,
            [`tags.${old_canon}`]: { $exists: true },
          },
          {
            $set: {
              [`tags.${new_canon}.name`]: new_name,
              [`tags.${new_canon}.touched`]: now,
              [`tags.${new_canon}.touched_by`]: this.userId,
              touched: now,
              touched_by: this.userId,
            },
          }
        );
        if (1 !== ct) {
          throw new Meteor.Error(404, "No such object");
        }
        return;
      }
      if (this.isSimulation) {
        // this is all synchronous
        ct = coll.update(
          {
            _id: id,
            [`tags.${old_canon}`]: { $exists: true },
            [`tags.${new_canon}`]: { $exists: false },
          },
          {
            $set: {
              [`tags.${new_canon}.name`]: new_name,
              [`tags.${new_canon}.touched`]: now,
              [`tags.${new_canon}.touched_by`]: this.userId,
              touched: now,
              touched_by: this.userId,
            },
            $rename: {
              [`tags.${old_canon}.value`]: `tags.${new_canon}.value`,
            },
          }
        );
        if (ct === 1) {
          coll.update({ _id: id }, { $unset: { [`tags.${old_canon}`]: "" } });
        } else {
          throw new Meteor.Error(404, "No such object");
        }
        return;
      }
      // On the server, use aggregation pipeline to make the whole edit in a single
      // call to avoid a race condition. This requires rawCollection because the
      // wrappers don't support aggregation pipelines.
      const result = await coll.rawCollection().updateOne(
        {
          _id: id,
          [`tags.${old_canon}`]: { $exists: true },
          [`tags.${new_canon}`]: { $exists: false },
        },
        [
          {
            $addFields: {
              [`tags.${new_canon}`]: {
                value: `$tags.${old_canon}.value`,
                name: { $literal: new_name },
                touched: now,
                touched_by: { $literal: this.userId },
              },
              touched: now,
              touched_by: { $literal: this.userId },
            },
          },
          { $unset: `tags.${old_canon}` },
        ]
      );
      if (1 === result.modifiedCount) {
        // Since we used rawCollection, we Have to trigger subscription update manually.
        Meteor.refresh({ collection: type, id });
      } else {
        throw new Meteor.Error(404, "No such object");
      }
    },

    async deleteTag(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          name: NonEmptyString,
          type: ValidType,
          object: IdOrObject,
        })
      );
      const id = args.object._id || args.object;
      const name = canonical(args.name);
      // bail to deleteAnswer if this is the 'answer' tag.
      if (name === "answer") {
        return await Meteor.callAsync("deleteAnswer", {
          type: args.type,
          target: args.object,
        });
      }
      if (name === "link") {
        args.fields = { link: null };
        return await Meteor.callAsync("setField", args);
      }
      args.now = Date.now(); // don't let caller lie about the time
      const updateDoc = {
        $set: {
          touched: args.now,
          touched_by: this.userId,
        },
      };
      deleteTagInternal(updateDoc, name);
      return (
        0 <
        (await collection(args.type).updateAsync(
          { _id: id, [`tags.${name}`]: { $exists: true } },
          updateDoc
        ))
      );
    },

    async summon(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          object: IdOrObject,
          how: Match.Optional(NonEmptyString),
        })
      );
      const id = args.object._id || args.object;
      const obj = await Puzzles.findOneAsync(id);
      if (obj == null) {
        return `Couldn't find puzzle ${id}`;
      }
      if (obj.solved) {
        return `puzzle ${obj.name} is already answered`;
      }
      const wasStuck = isStuck(obj);
      const rawhow = args.how || "Stuck";
      const how = rawhow.toLowerCase().startsWith("stuck")
        ? rawhow
        : `Stuck: ${rawhow}`;
      await Meteor.callAsync("setTag", {
        object: id,
        type: "puzzles",
        name: "Status",
        value: how,
        now: Date.now(),
      });
      if (isStuck(obj)) {
        return;
      }
      await oplog("Help requested for", "puzzles", id, this.userId, "stuck");
      let body = `has requested help: ${rawhow}`;
      await Meteor.callAsync("newMessage", {
        action: true,
        body,
        room_name: `puzzles/${id}`,
        on_behalf: true,
      });
      // see Router.urlFor
      const objUrl = Meteor._relativeToSiteRootUrl(`/puzzles/${id}`);
      const solverTimePart =
        obj.solverTime != null
          ? `; ${Math.floor(obj.solverTime / 60000)} solver-minutes`
          : "";
      body = `has requested help: ${UI._escape(
        rawhow
      )} (puzzle <a href=\"${objUrl}\">${UI._escape(
        obj.name
      )}</a>${solverTimePart})`;
      await Meteor.callAsync("newMessage", {
        action: true,
        bodyIsHtml: true,
        body,
        header_ignore: true,
        on_behalf: true,
      });
    },

    async unsummon(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          object: IdOrObject,
        })
      );
      const id = args.object._id || args.object;
      const obj = await Puzzles.findOneAsync(id);
      if (obj == null) {
        return `Couldn't find puzzle ${id}`;
      }
      if (!isStuck(obj)) {
        return `puzzle ${obj.name} isn't stuck`;
      }
      await oplog("Help request cancelled for", "puzzles", id, this.userId);
      const sticker = obj.tags.status?.touched_by;
      await Meteor.callAsync("deleteTag", {
        object: id,
        type: "puzzles",
        name: "status",
        now: Date.now(),
      });
      let body = "has arrived to help";
      if (this.userId === sticker) {
        body = "no longer needs help getting unstuck";
      }
      await Meteor.callAsync("newMessage", {
        action: true,
        body,
        room_name: `puzzles/${id}`,
        on_behalf: true,
      });
      body = `${body} in puzzle ${obj.name}`;
      await Meteor.callAsync("newMessage", {
        action: true,
        body,
        header_ignore: true,
        on_behalf: true,
      });
    },

    async getRoundForPuzzle(puzzle) {
      check(this.userId, NonEmptyString);
      check(puzzle, IdOrObject);
      const id = puzzle._id || puzzle;
      check(id, NonEmptyString);
      return await Rounds.findOneAsync({ puzzles: id });
    },

    async moveWithinMeta(id, parentId, args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        Match.OneOf(
          ObjectWith({ pos: Number }),
          ObjectWith({ before: NonEmptyString }),
          ObjectWith({ after: NonEmptyString })
        )
      );
      args.who = this.userId;
      return await moveWithinParent(id, "puzzles", parentId, args);
    },

    async moveWithinRound(id, parentId, args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        Match.OneOf(
          ObjectWith({ pos: Number }),
          ObjectWith({ before: NonEmptyString }),
          ObjectWith({ after: NonEmptyString })
        )
      );
      args.who = this.userId;
      return await moveWithinParent(id, "rounds", parentId, args);
    },

    async moveRound(id, dir) {
      check(this.userId, NonEmptyString);
      check(id, NonEmptyString);
      const round = await Rounds.findOneAsync(id);
      let order = 1;
      let op = "$gt";
      if (dir < 0) {
        order = -1;
        op = "$lt";
      }
      const query = {};
      query[op] = round.sort_key;
      const last = await Rounds.findOneAsync(
        { sort_key: query },
        { sort: { sort_key: order } }
      );
      if (last == null) {
        return;
      }
      await Rounds.updateAsync(id, { $set: { sort_key: last.sort_key } });
      await Rounds.updateAsync(last._id, {
        $set: { sort_key: round.sort_key },
      });
    },

    async setAnswer(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          target: IdOrObject,
          answer: NonEmptyString,
          backsolve: Match.Optional(Boolean),
          provided: Match.Optional(Boolean),
        })
      );
      const id = args.target._id || args.target;
      const result = await Mongo.withTransaction(async () => {
        const puzzle = await Puzzles.findOneAsync(id, {
          fields: { "tags.answer": 1 },
        });
        return await setAnswerInternal(
          this,
          puzzle,
          args.answer,
          args.backsolve,
          args.provided
        );
      });
      if (!result) {
        return false;
      }
      // Accumulate solver time for currrent presence outside transaction
      await recentSolverTime(id);

      return true;
    },

    async finalizeAnswers(_id) {
      check(this.userId, NonEmptyString);
      check(_id, String);
      const result = await Mongo.withTransaction(async () => {
        const puzzle = await Puzzles.findOneAsync(
          { _id, solved: null },
          {
            fields: { "tags.answer": 1, answers: 1 },
          }
        );
        if (!puzzle?.answers?.length) {
          return false;
        }
        puzzle.answers.sort();
        return await setAnswerInternal(
          this,
          puzzle,
          puzzle.answers.join("; "),
          false,
          false
        );
      });
      if (!result) {
        return false;
      }

      // Accumulate solver time for currrent presence outside transaction
      await recentSolverTime(_id);

      return true;
    },

    async deleteAnswer(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          target: IdOrObject,
        })
      );
      const id = args.target._id || args.target;
      const now = Date.now();
      const updateDoc = {
        $set: {
          solved: null,
          solved_by: null,
          confirmed_by: null,
          touched: now,
          touched_by: this.userId,
        },
      };
      deleteTagInternal(updateDoc, "answer");
      deleteTagInternal(updateDoc, "backsolve");
      deleteTagInternal(updateDoc, "provided");
      await Puzzles.updateAsync(id, updateDoc);
      await oplog("Deleted answer for", "puzzles", id, this.userId);
      return true;
    },

    async deletePartialAnswer(_id, answer) {
      check(this.userId, NonEmptyString);
      check(_id, String);
      check(answer, String);
      const changed = await Puzzles.updateAsync(
        { _id, solved: null, answers: answer },
        {
          $pull: {
            answers: answer,
          },
          $set: {
            touched: Date.now(),
            touched_by: this.userId,
          },
        }
      );
      if (changed) {
        await oplog(
          `Deleted partial answer ${answer} for`,
          "puzzles",
          _id,
          this.userId
        );
      }
    },

    async favorite(puzzle) {
      check(this.userId, NonEmptyString);
      check(puzzle, NonEmptyString);
      const num = await Puzzles.updateAsync(puzzle, {
        $set: {
          [`favorites.${this.userId}`]: true,
        },
      });
      return num > 0;
    },

    async unfavorite(puzzle) {
      check(this.userId, NonEmptyString);
      check(puzzle, NonEmptyString);
      const num = await Puzzles.updateAsync(puzzle, {
        $unset: {
          [`favorites.${this.userId}`]: "",
        },
      });
      return num > 0;
    },

    async addMechanic(puzzle, mechanic) {
      check(this.userId, NonEmptyString);
      check(puzzle, NonEmptyString);
      check(mechanic, IsMechanic);
      const num = await Puzzles.updateAsync(puzzle, {
        $addToSet: { mechanics: mechanic },
        $set: {
          touched: Date.now(),
          touched_by: this.userId,
        },
      });
      if (num <= 0) {
        throw new Meteor.Error(404, "bad puzzle");
      }
    },

    async removeMechanic(puzzle, mechanic) {
      check(this.userId, NonEmptyString);
      check(puzzle, NonEmptyString);
      check(mechanic, IsMechanic);
      const num = await Puzzles.updateAsync(puzzle, {
        $pull: { mechanics: mechanic },
        $set: {
          touched: Date.now(),
          touched_by: this.userId,
        },
      });
      if (num <= 0) {
        throw new Meteor.Error(404, "bad puzzle");
      }
    },

    async newPoll(room, question, options) {
      check(this.userId, NonEmptyString);
      check(room, NonEmptyString);
      check(question, NonEmptyString);
      check(options, ArrayWithLength(NonEmptyString, { min: 2, max: 5 }));
      const canonOpts = new Set();
      const opts = [];
      for (let opt of options) {
        const copt = canonical(opt);
        if (canonOpts.has(copt)) {
          continue;
        }
        canonOpts.add(copt);
        opts.push({ canon: copt, option: opt });
      }
      const id = await Polls.insertAsync({
        created: Date.now(),
        created_by: this.userId,
        question,
        options: opts,
        votes: {},
      });
      await newMessage({
        nick: this.userId,
        body: question,
        room_name: room,
        poll: id,
        on_behalf: true,
      });
      return id;
    },

    async vote(poll, option) {
      check(this.userId, NonEmptyString);
      check(poll, NonEmptyString);
      check(option, NonEmptyString);
      // This atomically checks that the poll exists and the option is valid,
      // then replaces any existing vote the user made.
      return await Polls.updateAsync(
        {
          _id: poll,
          "options.canon": option,
        },
        {
          $set: {
            [`votes.${this.userId}`]: { canon: option, timestamp: Date.now() },
          },
        }
      );
    },

    async setPuzzleForEvent(event, puzzle) {
      check(this.userId, NonEmptyString);
      check(event, NonEmptyString);
      check(puzzle, Match.Maybe(NonEmptyString));
      let update;
      if (puzzle != null) {
        check(await Puzzles.findOneAsync({ _id: puzzle }), Object);
        update = { $set: { puzzle } };
      } else {
        update = { $unset: { puzzle: "" } };
      }
      return 0 < (await CalendarEvents.updateAsync({ _id: event }, update));
    },

    async addEventAttendee(event, who) {
      check(this.userId, NonEmptyString);
      check(event, NonEmptyString);
      check(await Meteor.users.findOneAsync({ _id: who }), Object);
      return (
        0 <
        (await CalendarEvents.updateAsync(
          { _id: event },
          { $addToSet: { attendees: who } }
        ))
      );
    },

    async removeEventAttendee(event, who) {
      check(this.userId, NonEmptyString);
      check(event, NonEmptyString);
      check(await Meteor.users.findOneAsync({ _id: who }), Object);
      return (
        0 <
        (await CalendarEvents.updateAsync(
          { _id: event },
          { $pull: { attendees: who } }
        ))
      );
    },

    // if a round/puzzle folder gets accidentally deleted, this can be used to
    // manually re-create it.
    async fixPuzzleFolder(args) {
      check(this.userId, NonEmptyString);
      check(
        args,
        ObjectWith({
          object: IdOrObject,
          name: NonEmptyString,
        })
      );
      const id = args.object._id || args.object;
      if (
        0 ===
        (await Puzzles.updateAsync(
          { _id: id, drive_status: { $nin: ["creating", "fixing"] } },
          { $set: { drive_status: "fixing" } }
        ))
      ) {
        throw new Meteor.Error("Can't fix this puzzle folder now");
      }
      await newDriveFolder(id, args.name);
      // This is an onduty action, so defer expiry
      await Meteor.callAsync("renewOnduty");
    },
  });
})();
