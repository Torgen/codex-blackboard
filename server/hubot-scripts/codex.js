import {
  scripts,
  rejoin,
  strip,
  thingRE,
  objectFromRoom,
} from "../imports/botutil.js";
import { callAs, impersonating } from "../imports/impersonate.js";
import { all_settings } from "/lib/imports/settings.js";
import canonical from "/lib/imports/canonical.js";
import { pretty_collection } from "/lib/imports/collections.js";
import isDuplicateError from "/lib/imports/duplicate.js";
import * as callin_types from "/lib/imports/callin_types.js";

export default scripts.codex = function (robot) {
  //# ANSWERS
  async function targetByName(msg, name, who) {
    const target = await callAs("getByName", who, {
      name,
      optional_type: "puzzles",
    });
    if (!target) {
      msg.reply({ useful: true }, `I can't find a puzzle called "${name}".`);
      msg.finish();
      return;
    }
    return target;
  }

  // setAnswer
  robot.commands.push(
    "bot the answer to <puzzle> is <answer> - Updates codex blackboard"
  );
  robot.respond(
    rejoin(/The answer to /, thingRE, /\ is /, thingRE, /$/i),
    async function (msg) {
      const name = strip(msg.match[1]);
      const answer = strip(msg.match[2]);
      const who = msg.envelope.user.id;
      const target = await targetByName(msg, name, who);
      if (!target) {
        return;
      }
      const res = await callAs("setAnswer", who, {
        type: target.type,
        target: target.object._id,
        answer,
      });
      if (!res) {
        await msg.reply(
          { useful: true },
          msg.random([
            "I knew that!",
            "Not news to me.",
            "Already known.",
            "It is known.",
            "So say we all.",
          ])
        );
        return;
      }
      const solution_banter = [
        "Huzzah!",
        "Yay!",
        "Pterrific!",
        "I'm codexstactic!",
        "Who'd have thought?",
        `${answer}?  Really?  Whoa.`,
        "Rock on!",
        `${target.object.name} bites the dust!`,
        `${target.object.name}, meet ${answer}.  We rock!`,
      ];
      await msg.reply({ useful: true }, msg.random(solution_banter));
      msg.finish();
    }
  );

  async function newCallIn(msg, name, prefix, params) {
    let target;
    const who = msg.envelope.user.id;
    if (name != null) {
      target = await targetByName(msg, name, who);
      if (!target) {
        return;
      }
    } else {
      target = await objectFromRoom(msg);
      if (target == null) {
        return;
      }
      if (target.object.answers && !params.callin_type) {
        params.callin_type = callin_types.PARTIAL_ANSWER;
      }
    }
    await callAs("newCallIn", who, {
      target_type: target.type,
      target: target.object._id,
      ...params,
    });
    // I don't mind a little redundancy, but if it bothers you uncomment this:
    //suppressRoom: msg.envelope.room
    await msg.reply(
      { useful: true },
      `Okay, ${prefix}"${params.answer}" for #${target.type}/${target.object._id} added to call-in list!`
    );
    msg.finish();
  }

  // newCallIn
  robot.commands.push(
    "bot call in <answer> [for <puzzle>] - Updates codex blackboard"
  );
  robot.respond(
    rejoin(
      /Call\s*in((?: (?:backsolved?|provided))*)( answer)? /,
      thingRE,
      "(?:",
      /\ for /,
      thingRE,
      ")?",
      /$/i
    ),
    async function (msg) {
      const backsolve = /backsolve/.test(msg.match[1]);
      const provided = /provided/.test(msg.match[1]);
      const answer = strip(msg.match[3]);
      const name = msg.match[4] != null ? strip(msg.match[4]) : undefined;
      await newCallIn(msg, name, "", {
        answer,
        backsolve,
        provided,
      });
    }
  );

  robot.commands.push(
    "bot request interaction <answer> [for <puzzle>] - Updates codex blackboard"
  );
  robot.commands.push(
    "bot tell hq <message> [for <puzzle>] - Updates codex blackboard"
  );
  robot.commands.push(
    "bot expect callback <message> [for <puzzle>] - Updates codex blackboard"
  );
  robot.respond(
    rejoin(
      /(Request\s+interaction|tell\s+hq|expect\s+callback) /,
      thingRE,
      "(?:",
      /\ for /,
      thingRE,
      ")?",
      /$/i
    ),
    async function (msg) {
      const callin_type = {
        request_interaction: callin_types.INTERACTION_REQUEST,
        tell_hq: callin_types.MESSAGE_TO_HQ,
        expect_callback: callin_types.EXPECTED_CALLBACK,
      }[canonical(msg.match[1])];
      const answer = strip(msg.match[2]);
      const name = msg.match[3] != null ? strip(msg.match[3]) : undefined;
      await newCallIn(msg, name, `${callin_type} `, {
        answer,
        callin_type,
      });
    }
  );

  // deleteAnswer
  robot.commands.push(
    "bot delete the answer to <puzzle> - Updates codex blackboard"
  );
  robot.respond(
    rejoin(/Delete( the)? answer (to|for)( puzzle)? /, thingRE, /$/i),
    async function (msg) {
      const name = strip(msg.match[4]);
      const who = msg.envelope.user.id;
      const target = await targetByName(msg, name, who);
      if (!target) {
        return;
      }
      await callAs("deleteAnswer", who, {
        type: target.type,
        target: target.object._id,
      });
      await msg.reply(
        { useful: true },
        `Okay, I deleted the answer to #${target.type}/${target.object._id}.`
      );
      msg.finish();
    }
  );

  //# PUZZLES

  // newPuzzle
  robot.commands.push(
    "bot <puzzle> is a new [meta]puzzle in <round/meta> [with link <url>]- Updates codex blackboard"
  );
  robot.respond(
    rejoin(
      thingRE,
      /\ is a new (meta|puzzle|metapuzzle) in(?: (round|meta))? /,
      thingRE,
      "(?:",
      / with (?:url|link) /,
      thingRE,
      ")?",
      /$/i
    ),
    async function (msg) {
      let puzzle;
      const pname = strip(msg.match[1]);
      const ptype = msg.match[2];
      const rname = strip(msg.match[4]);
      let tname = undefined;
      let round = undefined,
        rText = undefined;
      const url = strip(msg.match[5]);
      const who = msg.envelope.user.id;
      if (rname === "this" && !msg.match[3]) {
        round = await objectFromRoom(msg);
        rText = "this";
        if (round == null) {
          return;
        }
      } else {
        if (msg.match[3] === "round") {
          tname = "rounds";
        } else if (msg.match[3] === "meta") {
          tname = "puzzles";
        }
        round = await callAs("getByName", who, {
          name: rname,
          optional_type: tname,
        });
        if (!round) {
          const descriptor = tname
            ? `a ${pretty_collection(tname)}`
            : "anything";
          msg.reply(
            { useful: true },
            `I can't find ${descriptor} called "${rname}".`
          );
          msg.finish();
          return;
        }
        rText = `#${tname}/${round.object._id}`;
      }
      const extra = { name: pname };
      if (url != null) {
        extra.link = url;
      }
      if (round.type === "rounds") {
        extra.round = round.object._id;
      } else if (round.type === "puzzles") {
        const metaround = await callAs(
          "getRoundForPuzzle",
          who,
          round.object._id
        );
        extra.round = metaround._id;
        extra.feedsInto = [round.object._id];
      } else {
        await msg.reply(
          { useful: true },
          `A new puzzle can't be created in "${rname}" because it's a ${pretty_collection(
            round.type
          )}.`
        );
        msg.finish();
        return;
      }
      if (ptype !== "puzzle") {
        extra.puzzles = [];
      }
      try {
        puzzle = await callAs("newPuzzle", who, extra);
      } catch (error) {
        if (isDuplicateError(error)) {
          const existing = await callAs("getByName", who, {
            name: pname,
            type: "puzzles",
          });
          await msg.reply(
            { useful: true },
            `There's already a puzzle named #puzzles/${existing.object._id}.`
          );
        } else {
          console.log(error);
          await msg.reply(
            { useful: true },
            "There was an error creating that puzzle."
          );
        }
        msg.finish();
        return;
      }
      await msg.reply(
        { useful: true },
        `Okay, I added #puzzles/${puzzle._id} to #${rText}.`
      );
      msg.finish();
    }
  );

  // deletePuzzle
  robot.commands.push("bot delete puzzle <puzzle> - Updates codex blackboard");
  robot.respond(rejoin(/Delete puzzle /, thingRE, /$/i), async function (msg) {
    const name = strip(msg.match[1]);
    const who = msg.envelope.user.id;
    const puzzle = await targetByName(msg, name, who);
    if (!puzzle) {
      return;
    }
    const res = await callAs("deletePuzzle", who, puzzle.object._id);
    if (res) {
      // Can't use a mention because it's about to not exist.
      await msg.reply(
        { useful: true },
        `Okay, I deleted "${puzzle.object.name}".`
      );
    } else {
      await msg.reply({ useful: true }, "Something went wrong.");
    }
    msg.finish();
  });

  //# ROUNDS

  // newRound
  robot.commands.push(
    "bot <round> is a new round [with link <url>] - Updates codex blackboard"
  );
  robot.respond(
    rejoin(
      thingRE,
      /\ is a new round/,
      "(?:",
      / with (?:url|link) /,
      thingRE,
      ")?",
      /$/i
    ),
    async function (msg) {
      let round;
      const rname = strip(msg.match[1]);
      const url = strip(msg.match[2]);
      const who = msg.envelope.user.id;
      const body = { name: rname };
      if (url != null) {
        body.link = url;
      }
      try {
        round = await callAs("newRound", who, body);
      } catch (error) {
        if (isDuplicateError(error)) {
          const existing = await callAs("getByName", who, {
            name: rname,
            type: "rounds",
          });
          await msg.reply(
            { useful: true },
            `There's already a round named #rounds/${existing.object._id}.`
          );
        } else {
          console.log(error);
          await msg.reply(
            { useful: true },
            "There was an error creating that puzzle."
          );
        }
        await msg.finish();
        return;
      }
      await msg.reply(
        { useful: true },
        `Okay, I created round #rounds/${round._id}.`
      );
      msg.finish();
    }
  );

  // deleteRound
  robot.commands.push("bot delete round <round> - Updates codex blackboard");
  robot.respond(rejoin(/Delete round /, thingRE, /$/i), async function (msg) {
    const rname = strip(msg.match[1]);
    const who = msg.envelope.user.id;
    const round = await callAs("getByName", who, {
      name: rname,
      optional_type: "rounds",
    });
    if (!round) {
      await msg.reply(
        { useful: true },
        `I can't find a round called "${rname}".`
      );
      return;
    }
    const res = await callAs("deleteRound", who, round.object._id);
    if (!res) {
      await msg.reply(
        { useful: true },
        "Couldn't delete round. (Are there still puzzles in it?)"
      );
      return;
    }
    await msg.reply(
      { useful: true },
      // Can't use a mention because it no longer exists.
      `Okay, I deleted round "${round.object.name}".`
    );
    msg.finish();
  });

  async function tagChangeTarget(msg) {
    let target, type;
    if (msg.match[2] != null) {
      const descriptor =
        msg.match[3] != null
          ? `a ${pretty_collection(msg.match[3])}`
          : "anything";
      type =
        msg.match[3] != null
          ? msg.match[3].replace(/\s+/g, "") + "s"
          : undefined;
      target = await callAs("getByName", msg.envelope.user.id, {
        name: strip(msg.match[4]),
        optional_type: type,
      });
      if (target == null) {
        await msg.reply(
          { useful: true },
          `I can't find ${descriptor} called "${strip(msg.match[4])}".`
        );
        msg.finish();
        return [null, null];
      }
      return [target, `#${target.type}/${target.object._id}`];
    } else {
      return [await objectFromRoom(msg), "this"];
    }
  }

  // Tags
  robot.commands.push(
    "bot set <tag> [of <puzzle|round>] to <value> - Adds additional information to blackboard"
  );
  robot.respond(
    rejoin(
      /set (?:the )?/,
      thingRE,
      "(",
      /\ (?:of|for) (?:(puzzle|round) )?/,
      thingRE,
      ")? to ",
      thingRE,
      /$/i
    ),
    async function (msg) {
      const tag_name = strip(msg.match[1]);
      const tag_value = strip(msg.match[5]);
      const [target, tText] = await tagChangeTarget(msg);
      if (target == null) {
        return;
      }
      await callAs("setTag", msg.envelope.user.id, {
        type: target.type,
        object: target.object._id,
        name: tag_name,
        value: tag_value,
      });
      await msg.reply(
        { useful: true },
        `The ${tag_name} for ${tText} is now "${tag_value}".`
      );
      msg.finish();
    }
  );

  robot.commands.push(
    "bot unset <tag> [of <puzzle|round>] - Removes information from blackboard"
  );
  robot.respond(
    rejoin(
      /unset (?:the )?/,
      thingRE,
      "(",
      /\ (?:of|for) (?:(puzzle|round) )?/,
      thingRE,
      ")?",
      /$/i
    ),
    async function (msg) {
      const tag_name = strip(msg.match[1]);
      const [target, tText] = await tagChangeTarget(msg);
      if (target == null) {
        return;
      }
      const res = await callAs("deleteTag", msg.envelope.user.id, {
        type: target.type,
        object: target.object._id,
        name: tag_name,
      });
      if (res) {
        await msg.reply(
          { useful: true },
          `The ${tag_name} for ${tText} is now unset.`
        );
      } else {
        await msg.reply(
          { useful: true },
          `${tText} didn't have ${tag_name} set!`
        );
      }
      msg.finish();
    }
  );

  function modifyStuckStatus(messageForOtherRoom, fn) {
    return async function (msg) {
      let target;
      const who = msg.envelope.user.id;
      if (msg.match[1] != null) {
        target = await callAs("getByName", who, {
          name: msg.match[1],
          optional_type: "puzzles",
        });
        if (target == null) {
          await msg.reply(
            { useful: true },
            `I don't know what "${msg.match[1]}" is.`
          );
          msg.finish();
          return;
        }
      } else {
        target = await objectFromRoom(msg);
        if (target == null) {
          return;
        }
      }
      if (target.type !== "puzzles") {
        await msg.reply({ useful: true }, "Only puzzles can be stuck.");
        msg.finish();
        return;
      }
      const result = await fn(who, target.object._id, msg.match[2]);
      if (result != null) {
        await msg.reply({ useful: true }, result);
        msg.finish();
        return;
      }
      if (
        msg.envelope.room !== "general/0" &&
        msg.envelope.room !== `puzzles/${target.object._id}`
      ) {
        await msg.reply({ useful: true }, messageForOtherRoom);
      }
      msg.finish();
    };
  }

  // Stuck
  robot.commands.push(
    "bot stuck[ on <puzzle>][ because <reason>] - summons help and marks puzzle as stuck on the blackboard"
  );
  robot.respond(
    rejoin("stuck(?: on ", thingRE, ")?(?: because ", thingRE, ")?", /$/i),
    modifyStuckStatus("Help is on the way.", (who, object, how) =>
      callAs("summon", who, { object, how })
    )
  );

  robot.commands.push(
    "but unstuck[ on <puzzle>] - marks puzzle no longer stuck on the blackboard"
  );
  robot.respond(
    rejoin("unstuck(?: on ", thingRE, ")?", /$/i),
    modifyStuckStatus("Call for help cancelled", (who, object) =>
      callAs("unsummon", who, { object })
    )
  );

  const wordOrQuote = /([^\"\'\s]+|\"[^\"]+\"|\'[^\']+\')/;

  robot.commands.push('bot poll "Your question" "option 1" "option 2"...');
  robot.respond(
    rejoin("poll ", wordOrQuote, "((?: ", wordOrQuote, ")+)", /$/i),
    async function (msg) {
      const optsRe = new RegExp(rejoin(" ", wordOrQuote), "g");
      const opts = [];
      let m;
      while ((m = optsRe.exec(msg.match[2]))) {
        opts.push(strip(m[1]));
      }
      if (opts.length < 2 || opts.length > 5) {
        await msg.reply({ useful: true }, "Must have between 2 and 5 options.");
        msg.finish();
        return;
      }
      await callAs(
        "newPoll",
        msg.envelope.user.id,
        msg.envelope.room,
        strip(msg.match[1]),
        opts
      );
      msg.finish();
    }
  );

  robot.commands.push("bot global list - lists dynamic settings");
  robot.respond(/global list$/i, async function (msg) {
    for (let canon in all_settings) {
      const setting = all_settings[canon];
      await msg.priv(
        { useful: true },
        `${setting.name}: ${
          setting.description
        }\nCurrent: '${await setting.get()}' Default: '${setting.default}'`
      );
    }
    msg.finish();
  });

  robot.commands.push(
    "bot global set <setting> to <value> - changes a dynamic setting"
  );
  return robot.respond(
    rejoin(/global set /, thingRE, / to /, thingRE, /$/i),
    async function (msg) {
      const setting_name = strip(msg.match[1]);
      const value = strip(msg.match[2]);
      const setting = all_settings[canonical(setting_name)];
      if (setting == null) {
        await msg.reply(
          { useful: true },
          `Sorry, I don't know the setting '${setting_name}'.`
        );
        return;
      }
      try {
        await impersonating(msg.envelope.user.id, () => setting.set(value));
        await msg.reply(
          { useful: true },
          `OK, set ${setting_name} to ${value}`
        );
      } catch (error) {
        await msg.reply(
          { useful: true },
          `Sorry, there was an error: ${error}`
        );
      }
    }
  );
};
