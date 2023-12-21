import { rejoin, scripts, thingRE, puzzleOrThis } from "../imports/botutil.js";
import { callAs } from "../imports/impersonate.js";

function ifPuzzleExists(msg, fn) {
  const name = msg.match[1];
  const p = puzzleOrThis(name, msg);
  if (!p) {
    if (msg.message.done) {
      return;
    }
    msg.reply({ useful: true }, `I can't find a puzzle called \"${name}\".`);
    msg.finish();
    return;
  }
  fn(name, p);
}

function makeMeta(msg) {
  ifPuzzleExists(msg, function (name, p) {
    const who = msg.envelope.user.id;
    if (callAs("makeMeta", who, p.object._id)) {
      msg.reply({ useful: true }, `OK, ${name} is now a meta.`);
    } else {
      msg.reply({ useful: true }, `${name} was already a meta.`);
    }
    msg.finish();
  });
}

function makeNotMeta(msg) {
  ifPuzzleExists(msg, function (name, p) {
    const l = p.object.puzzles?.length;
    if (l) {
      msg.reply(
        { useful: true },
        `${l} puzzle${l !== 1 ? "s" : ""} feed${l === 1 ? "s" : ""} into ${
          p.object.name
        }. It must be a meta.`
      );
      msg.finish();
      return;
    }
    const who = msg.envelope.user.id;
    if (callAs("makeNotMeta", who, p.object._id)) {
      msg.reply({ useful: true }, `OK, ${name} is no longer a meta.`);
    } else {
      msg.reply({ useful: true }, `${name} already wasn't a meta.`);
    }
    msg.finish();
  });
}

export default scripts.metas = function (robot) {
  robot.commands.push(
    "bot <puzzle|this> is a meta[puzzle] - Updates codex blackboard"
  );
  robot.respond(rejoin(thingRE, / is a meta(puzzle)?$/i), makeMeta);

  robot.commands.push(
    "bot make <puzzle|this> a meta[puzzle] - Updates codex blackboard"
  );
  robot.respond(rejoin(/make /, thingRE, / a meta(puzzle)?$/i), makeMeta);

  robot.commands.push(
    "bot <puzzle|this> isn't a meta[puzzle] - Updates codex blackboard"
  );
  robot.respond(
    rejoin(thingRE, / is(n't| not) a meta(puzzle)?$/i),
    makeNotMeta
  );

  function leafIntoMeta(msg, fn) {
    const puzzName = msg.match[1];
    const metaName = msg.match[2];
    const p = puzzleOrThis(puzzName, msg);
    if (p == null) {
      return;
    }
    const m = puzzleOrThis(metaName, msg);
    if (m == null) {
      return;
    }
    const who = msg.envelope.user.id;
    fn(p.object, m.object, who);
  }

  robot.commands.push(
    "bot <puzzle|this> feeds into <puzzle|this> - Update codex blackboard"
  );
  robot.respond(rejoin(thingRE, / feeds into /, thingRE, /$/i), function (msg) {
    leafIntoMeta(msg, function (p, m, who) {
      if (callAs("feedMeta", who, p._id, m._id)) {
        msg.reply(
          { useful: true },
          `OK, ${msg.match[1]} now feeds into ${msg.match[2]}.`
        );
      } else {
        msg.reply(
          { useful: true },
          `${msg.match[1]} already fed into ${msg.match[2]}.`
        );
      }
      msg.finish();
    });
  });

  robot.commands.push(
    "bot <puzzle|this> doesn't feed into <puzzle|this> - Update codex blackboard"
  );
  robot.respond(
    rejoin(thingRE, / does(?:n't| not) feed into /, thingRE, /$/i),
    function (msg) {
      leafIntoMeta(msg, function (p, m, who) {
        if (callAs("unfeedMeta", who, p._id, m._id)) {
          msg.reply(
            { useful: true },
            `OK, ${msg.match[1]} no longer feeds into ${msg.match[2]}.`
          );
        } else {
          msg.reply(
            { useful: true },
            `${msg.match[1]} already didn't feed into ${msg.match[2]}.`
          );
        }
        msg.finish();
      });
    }
  );
};
