// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import settings from '/lib/imports/settings.coffee';
// Test only works on server side; move to /server if you add client tests.
import { callAs, impersonating } from './impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('settings', function() {
  let clock = null;

  beforeEach(function() {
    resetDatabase();
    clock = sinon.useFakeTimers({
      now: 4,
      toFake: ['Date']});
    for (let canon in settings.all_settings) { const setting = settings.all_settings[canon]; setting.ensure(); }
    return clock.tick(3);
  });

  afterEach(() => clock.restore());
  
  describe('set', function() {
    it('fails without login', () => chai.assert.throws(() => settings.EmbedPuzzles.set(false)
    , Match.Error));

    it('sets default', () => chai.assert.deepEqual(settings.Settings.findOne('embed_puzzles'), {
      _id: 'embed_puzzles',
      value: true,
      touched: 4
    }
    ));

    describe('of boolean', function() {
      [false, true].forEach(function(b) {
        it(`allows boolean ${b}`, function() {
          impersonating('torgen', () => settings.EmbedPuzzles.set(b));
          return chai.assert.deepEqual(settings.Settings.findOne('embed_puzzles'), {
            _id: 'embed_puzzles',
            value: b,
            touched: 7,
            touched_by: 'torgen'
          }
          );
        });

        return it(`allows string ${b}`, function() {
          impersonating('torgen', () => settings.EmbedPuzzles.set(`${b}`));
          return chai.assert.deepEqual(settings.Settings.findOne('embed_puzzles'), {
            _id: 'embed_puzzles',
            value: b,
            touched: 7,
            touched_by: 'torgen'
          }
          );
        });
      });

      return it('fails on non-boolean', () => chai.assert.throws(() => impersonating('torgen', () => settings.EmbedPuzzles.set('something'))
      , Match.Error));
    });

    describe('of url', function() {
      ['http', 'https'].forEach(protocol => it(`allows protocol ${protocol}`, function() {
        const url = `${protocol}://molasses.holiday`;
        impersonating('torgen', () => settings.PuzzleUrlPrefix.set(url));
        return chai.assert.deepEqual(settings.Settings.findOne('puzzle_url_prefix'), {
          _id: 'puzzle_url_prefix',
          value: url,
          touched: 7,
          touched_by: 'torgen'
        }
        );
      }));

      return it('disallows ftp', () => chai.assert.throws(() => impersonating('torgen', () => settings.PuzzleUrlPrefix.set('ftp://log:pwd@molasses.holiday'))
      , Match.Error));
    });
    
    describe('of int', function() {
      it('allows integer', function() {
        impersonating('torgen', () => settings.MaximumMemeLength.set(925));
        return chai.assert.deepEqual(settings.Settings.findOne('maximum_meme_length'), {
          _id: 'maximum_meme_length',
          value: 925,
          touched: 7,
          touched_by: 'torgen'
        }
        );
      });

      it('allows string of integer', function() {
        impersonating('torgen', () => settings.MaximumMemeLength.set('633'));
        return chai.assert.deepEqual(settings.Settings.findOne('maximum_meme_length'), {
          _id: 'maximum_meme_length',
          value: 633,
          touched: 7,
          touched_by: 'torgen'
        }
        );
      });

      return it('allows string of integral float', function() {
        impersonating('torgen', () => settings.MaximumMemeLength.set('286.99'));
        return chai.assert.deepEqual(settings.Settings.findOne('maximum_meme_length'), {
          _id: 'maximum_meme_length',
          value: 286,
          touched: 7,
          touched_by: 'torgen'
        }
        );
      });
    });
    
    return describe('of path component', function() {
      const uuid = '469a2d19-8a0C-4650-8621-7077a6de8ee6';
      it('allows uuid', function() {
        impersonating('torgen', () => settings.StaticJitsiMeeting.set(uuid));
        return chai.assert.deepEqual(settings.Settings.findOne('static_jitsi_meeting'), {
          _id: 'static_jitsi_meeting',
          value: uuid,
          touched: 7,
          touched_by: 'torgen'
        }
        );
      });

      return it('canonicalizes', function() {
        impersonating('torgen', () => settings.StaticJitsiMeeting.set('it\'s ya boy Voynich'));
        return chai.assert.deepEqual(settings.Settings.findOne('static_jitsi_meeting'), {
          _id: 'static_jitsi_meeting',
          value: 'its_ya_boy_voynich',
          touched: 7,
          touched_by: 'torgen'
        }
        );
      });
    });
  });

  
  describe('get', () => it('allows legacy values', function() {
    // The old version used string as the value for all types, so if the
    // database has a string instead of a boolean, convert it.
    settings.Settings.upsert('embed_puzzles', {
      $set: {
        value: 'false',
        touched: 4,
        touched_by: 'cjb'
      }
    }
    );
    return chai.assert.isFalse(settings.EmbedPuzzles.get());
  }));

  return describe('changeSetting method', () => it('doesn\'t create setting', () => chai.assert.throws(() => callAs('changeSetting', 'torgen', 'foo', 'qux')
  , Match.Error)));
});
