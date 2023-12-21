import { newMessage } from "./newMessage.js";

function linkify(input) {
  // linkify hashtags, URLs, and usernames.  Do this all in one pass so
  // that we don't try to linkify the contents of a previously-converted
  // link  (ie, when given `http://user@host/foo#bar` ).
  const hashtagRE = /\#(?:\w+)/;
  const usernameRE = /@(?:[a-z0-9_]{1,15})(?![.a-z0-9_])/i;
  // Note that we are using Gruber's "Liberal, Accurate Regex Pattern",
  // as amended by @cscott in https://gist.github.com/gruber/249502
  const urlRE =
    /(?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:\'\".,<>?«»“”‘’])/i;
  // a little bit of magic to glue these regexps into a single pattern
  const pats = [urlRE, hashtagRE, usernameRE].map((re) => re.source);
  // start with ^|\s because there's no \b before @user and #hash
  // but also use \b to allow (http://...)
  const re = new RegExp("(^|\\b|\\s)(?:(" + pats.join(")|(") + "))", "ig");
  return input.replace(re, function (text, sp, url, hashtag, username) {
    switch (false) {
      case url == null:
        return `${sp}<a href='${url}' target='_blank'>${url}</a>`;
      case hashtag == null:
        return `${sp}<a href='https://twitter.com/search?q=${encodeURIComponent(
          hashtag,
        )}' target='_blank'>${hashtag}</a>`;
      case username == null:
        return `${sp}<a href='https://twitter.com/${encodeURIComponent(
          username.slice(1),
        )}' target='_blank'>${username}</a>`;
      default:
        return text;
    }
  });
}

function htmlify(data) {
  const text = data.extended_tweet?.full_text ?? data.full_text ?? data.text;
  return linkify(text);
}

function tweetToMessage(data) {
  if (data.retweeted_status != null) {
    return;
  } // don't report retweets
  if (data.user == null) {
    // weird bug we saw
    console.log("WEIRD TWIT!", data);
    return;
  }
  console.log(`Twitter! @${data.user.screen_name} ${data.text}`);
  const body = htmlify(data);
  const tweet = {
    id_str: data.id_str,
    avatar: data.user.profile_image_url_https,
  };
  if (data.quoted_status != null) {
    tweet.quote = htmlify(data.quoted_status);
    tweet.quote_id_str = data.quoted_status_id_str;
    tweet.quote_nick = data.quoted_status.user.screen_name;
  }

  return newMessage({
    nick: data.user.screen_name,
    room_name: "general/0",
    body,
    bodyIsHtml: true,
    bot_ignore: true,
    tweet,
  });
}
export default tweetToMessage;
