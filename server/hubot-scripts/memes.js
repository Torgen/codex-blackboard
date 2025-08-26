// Description:
//   Get a meme from https://memegen.link

import { scripts } from "/server/imports/botutil.js";
import { MaximumMemeLength } from "/lib/imports/settings.js";

export default scripts.memes = function (robot) {
  robot.hear(/Y U NO (.+)/i, (msg) => memegen(msg, "yuno", "", msg.match[1]));

  robot.hear(/aliens guy (.+)/i, (msg) =>
    memegen(msg, "aag", "", msg.match[1])
  );

  robot.hear(/(.*) (ALL the .*)/i, (msg) =>
    memegen(msg, "xy", msg.match[1], msg.match[2])
  );

  robot.hear(/(I DON\'?T ALWAYS .*) (BUT WHEN I DO,? .*)/i, (msg) =>
    memegen(msg, "interesting", msg.match[1], msg.match[2])
  );

  robot.hear(/(.*)(SUCCESS|NAILED IT.*)/i, (msg) =>
    memegen(msg, "success", msg.match[1], msg.match[2])
  );

  robot.hear(/(.*) (\w+\sTOO DAMN .*)/i, (msg) =>
    memegen(msg, "toohigh", msg.match[1], msg.match[2])
  );

  robot.hear(/(NOT SURE IF .*) (OR .*)/i, (msg) =>
    memegen(msg, "fry", msg.match[1], msg.match[2])
  );

  robot.hear(/(YO DAWG .*) (SO .*)/i, (msg) =>
    memegen(msg, "yodawg", msg.match[1], msg.match[2])
  );

  //robot.hear /(All your .*) (are belong to .*)/i, (msg) ->
  //  memegen msg, '', msg.match[1], msg.match[2]

  //robot.hear /(.*)\s*BITCH PLEASE\s*(.*)/i, (msg) ->
  //  memegen msg, '', msg.match[1], msg.match[2]

  //robot.hear /(.*)\s*COURAGE\s*(.*)/i, (msg) ->
  //  memegen msg, '', msg.match[1], msg.match[2]

  robot.hear(/ONE DOES NOT SIMPLY (.*)/i, (msg) =>
    memegen(msg, "mordor", "ONE DOES NOT SIMPLY", msg.match[1])
  );

  robot.hear(/(IF YOU .*\s)(.* GONNA HAVE A BAD TIME)/i, (msg) =>
    memegen(msg, "ski", msg.match[1], msg.match[2])
  );

  //robot.hear /(.*)TROLLFACE(.*)/i, (msg) ->
  //  memegen msg, 'dGAIFw', msg.match[1], msg.match[2]

  robot.hear(
    /(IF .*), ((ARE|CAN|DO|DOES|HOW|IS|MAY|MIGHT|SHOULD|THEN|WHAT|WHEN|WHERE|WHICH|WHO|WHY|WILL|WON\'T|WOULD)[ \'N].*)/i,
    (msg) =>
      memegen(
        msg,
        "philosoraptor",
        msg.match[1],
        msg.match[2] + (msg.match[2].search(/\?$/) === -1 ? "?" : "")
      )
  );

  //robot.hear /(.*)(AND IT\'S GONE.*)/i, (msg) ->
  //  memegen msg, 'uIZe3Q', msg.match[1], msg.match[2]

  robot.hear(/WHAT IF I TOLD YOU (.*)/i, (msg) =>
    memegen(msg, "morpheus", "WHAT IF I TOLD YOU", msg.match[1])
  );

  //robot.hear /WTF (.*)/i, (msg) ->
  //  memegen msg, '', 'WTF', msg.match[1]

  robot.hear(/(IF .*)(THAT\'D BE GREAT)/i, (msg) =>
    memegen(msg, "officespace", msg.match[1], msg.match[2])
  );

  robot.hear(/(MUCH .*) ((SO|VERY) .*)/i, (msg) =>
    memegen(msg, "doge", msg.match[1], msg.match[2])
  );

  robot.hear(/(.*)(EVERYWHERE.*)/i, (msg) =>
    memegen(msg, "buzz", msg.match[1], msg.match[2])
  );
};

const memeGeneratorUrl = "https://api.memegen.link";

// not a great conversion: no way to safely represent '~' or "'" eg
const convTable = {
  " ": "-",
  "-": "--",
  _: "__",
  "?": "~q",
  "%": "~p",
  "#": "~h",
  "/": "~s",
  '"': "''",
};

function encode(s) {
  return s.toLowerCase().replace(/[-_ ?%\#/\"]/g, (c) => convTable[c]);
}

async function memegen(msg, imageName, topText, botText) {
  if (msg.match[0].length > (await MaximumMemeLength.get())) {
    console.log(`Got a ${imageName} meme but it was too long`);
    return;
  }
  const url = `${memeGeneratorUrl}/${imageName}/${encode(topText)}/${encode(
    botText
  )}.jpg`;
  await msg.send(url);
}
