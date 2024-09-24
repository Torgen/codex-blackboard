import { Messages } from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import tweetToMessage from "./twitter.js";
import { clearCollections } from "/lib/imports/testutils.js";

describe("tweetToMessage", function () {
  let clock = null;
  beforeEach(async function () {
    await clearCollections(Messages);
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"],
    });
  });

  afterEach(() => clock.restore());

  it("posts short tweets", async function () {
    await tweetToMessage(require("./testdata/tweets/tweet.json"));
    chai.assert.deepInclude(
      await Messages.findOneAsync({ tweet: { $exists: true } }),
      {
        timestamp: 7,
        room_name: "general/0",
        nick: "ygritteygritte",
        body: "Regular tweet!",
        bodyIsHtml: true,
        bot_ignore: true,
        tweet: {
          id_str: "758796817370800129",
          avatar:
            "https://pbs.twimg.com/profile_images/735370259566329856/3mxqMJEq_normal.jpg",
        },
      }
    );
  });

  it("ignores retweets", async function () {
    await tweetToMessage(require("./testdata/tweets/retweet.json"));
    chai.assert.isUndefined(await Messages.findOneAsync());
  });

  it("linkifies", async function () {
    await tweetToMessage(require("./testdata/tweets/mention.json"));
    chai.assert.deepInclude(
      await Messages.findOneAsync({ tweet: { $exists: true } }),
      {
        timestamp: 7,
        room_name: "general/0",
        bodyIsHtml: true,
        bot_ignore: true,
        nick: "atornes",
        body: `Gnip 2.0 is here! So proud of the hard work of the whole \
<a href="https://twitter.com/gnip" target="_blank">@gnip</a> team \
to get us to this milestone! \
<a href="https://twitter.com/search?q=%23justthebeginning" \
target="_blank">#justthebeginning</a> \
<a href="https://t.co/lJq7Fzt1Re" \
target="_blank">https://t.co/lJq7Fzt1Re</a>`,
        tweet: {
          id_str: "760211303956832257",
          avatar:
            "https://pbs.twimg.com/profile_images/125375665/profile_pic_normal.jpg",
        },
      }
    );
  });

  it("uses full text", async function () {
    await tweetToMessage(require("./testdata/tweets/attachment.json"));
    chai.assert.deepInclude(
      await Messages.findOneAsync({ tweet: { $exists: true } }),
      {
        timestamp: 7,
        room_name: "general/0",
        bodyIsHtml: true,
        bot_ignore: true,
        nick: "ygritteygritte",
        body: `this is a tweet with 140 characters of display range text, which \
means that with an image attachment the full tweet text has \
&gt;140 characters \
<a href="https://t.co/ws1QmqeYo6" \
target="_blank">https://t.co/ws1QmqeYo6</a>`,
        tweet: {
          id_str: "755822121331281920",
          avatar:
            "https://pbs.twimg.com/profile_images/735370259566329856/3mxqMJEq_normal.jpg",
        },
      }
    );
  });

  it("embeds quote", async function () {
    await tweetToMessage(require("./testdata/tweets/quoted_w_attachment.json"));
    chai.assert.deepInclude(
      await Messages.findOneAsync({ tweet: { $exists: true } }),
      {
        timestamp: 7,
        room_name: "general/0",
        bodyIsHtml: true,
        bot_ignore: true,
        nick: "ygritteygritte",
        body: `this is a quote of a regular b140 tweet with an attachment \
<a href="https://t.co/sAt9qTEYWy" target="_blank">https://t.co/sAt9qTEYWy</a>`,
        tweet: {
          id_str: "758840203985289220",
          avatar:
            "https://pbs.twimg.com/profile_images/735370259566329856/3mxqMJEq_normal.jpg",
          quote: `this is a tweet with 140 characters of display range text, which \
means that with an image attachment the full tweet text has \
&gt;140 characters \
<a href="https://t.co/ws1QmqeYo6" \
target="_blank">https://t.co/ws1QmqeYo6</a>`,
          quote_id_str: "755822121331281920",
          quote_nick: "ygritteygritte",
        },
      }
    );
  });
});
