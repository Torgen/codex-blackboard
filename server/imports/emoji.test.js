// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import emojify from './emoji.coffee';
import chai from 'chai';

describe('emojify', function() {
  it('replaces multiple emoji', () => chai.assert.equal(emojify(':wolf: in a :tophat:'), '🐺 in a 🎩'));

  return it('ignores non-emoji', () => chai.assert.equal(emojify(':fox_face: :capybara: :rabbit:'), '🦊 :capybara: 🐰'));
});
