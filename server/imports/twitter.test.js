// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { Messages } from '/lib/imports/collections.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import tweetToMessage from './twitter.coffee';

describe('tweetToMessage', function() {
  let clock = null;
  beforeEach(function() {
    resetDatabase();
    return clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date"]});});

  afterEach(() => clock.restore());

  it('posts short tweets', function() {
    tweetToMessage(require('./testdata/tweets/tweet.json'));
    return chai.assert.deepInclude(Messages.findOne({tweet: {$exists: true}}), {
      timestamp: 7,
      room_name: 'general/0',
      nick: 'ygritteygritte',
      body: 'Regular tweet!',
      bodyIsHtml: true,
      bot_ignore: true,
      tweet: {
        id_str: '758796817370800129',
        avatar: 'https://pbs.twimg.com/profile_images/735370259566329856/3mxqMJEq_normal.jpg'
      }
    }
    );
  });

  it('ignores retweets', function() {
    tweetToMessage(require('./testdata/tweets/retweet.json'));
    return chai.assert.isUndefined(Messages.findOne());
  });

  it('linkifies', function() {
    tweetToMessage(require('./testdata/tweets/mention.json'));
    return chai.assert.deepInclude(Messages.findOne({tweet: {$exists: true}}), {
      timestamp: 7,
      room_name: 'general/0',
      bodyIsHtml: true,
      bot_ignore: true,
      nick: 'atornes',
      body: `Gnip 2.0 is here! So proud of the hard work of the whole \
<a href="https://twitter.com/gnip" target="_blank">@gnip</a> team \
to get us to this milestone! \
<a href="https://twitter.com/search?q=%23justthebeginning" \
target="_blank">#justthebeginning</a> \
<a href="https://t.co/lJq7Fzt1Re" \
target="_blank">https://t.co/lJq7Fzt1Re</a>`,
      tweet: {
        id_str: '760211303956832257',
        avatar: 'https://pbs.twimg.com/profile_images/125375665/profile_pic_normal.jpg'
      }
    }
    );
  });

  it('uses full text', function() {
    tweetToMessage(require('./testdata/tweets/attachment.json'));
    return chai.assert.deepInclude(Messages.findOne({tweet: {$exists: true}}), {
      timestamp: 7,
      room_name: 'general/0',
      bodyIsHtml: true,
      bot_ignore: true,
      nick: 'ygritteygritte',
      body: `this is a tweet with 140 characters of display range text, which \
means that with an image attachment the full tweet text has \
&gt;140 characters \
<a href="https://t.co/ws1QmqeYo6" \
target="_blank">https://t.co/ws1QmqeYo6</a>`,
      tweet: {
        id_str: '755822121331281920',
        avatar: 'https://pbs.twimg.com/profile_images/735370259566329856/3mxqMJEq_normal.jpg'
      }
    }
    );
  });

  return it('embeds quote', function() {
    tweetToMessage(require('./testdata/tweets/quoted_w_attachment.json'));
    return chai.assert.deepInclude(Messages.findOne({tweet: {$exists: true}}), {
      timestamp: 7,
      room_name: 'general/0',
      bodyIsHtml: true,
      bot_ignore: true,
      nick: 'ygritteygritte',
      body: `this is a quote of a regular b140 tweet with an attachment \
<a href="https://t.co/sAt9qTEYWy" target="_blank">https://t.co/sAt9qTEYWy</a>`,
      tweet: {
        id_str: '758840203985289220',
        avatar: 'https://pbs.twimg.com/profile_images/735370259566329856/3mxqMJEq_normal.jpg',
        quote: `this is a tweet with 140 characters of display range text, which \
means that with an image attachment the full tweet text has \
&gt;140 characters \
<a href="https://t.co/ws1QmqeYo6" \
target="_blank">https://t.co/ws1QmqeYo6</a>`,
        quote_id_str: '755822121331281920',
        quote_nick: 'ygritteygritte'
      }
    }
    );
  });
});



  
