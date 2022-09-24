/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import * as tags from './tags.coffee';
import chai from 'chai';

describe('getTag', function() {
  it('accepts missing object', () => chai.assert.isUndefined(tags.getTag(null, 'foo')));

  it('accepts missing tags', () => chai.assert.isUndefined(tags.getTag({}, 'foo')));

  it('accepts empty tags', () => chai.assert.isUndefined(tags.getTag({tags: {}}, 'foo')));

  it('accepts nonmatching tags', () => chai.assert.isUndefined(tags.getTag({tags: {yo: {name: 'Yo', value: 'ho ho'}}}, 'foo')));

  it('accepts matching tags', () => chai.assert.equal(tags.getTag({tags: {yo: {name: 'Yo', value: 'ho ho'}}}, 'yo'), 'ho ho'));

  return it('canonicalizes tags', () => chai.assert.equal(tags.getTag({tags: {yo: {name: 'Yo', value: 'ho ho'}}}, 'yO'), 'ho ho'));
});

describe('isStuck', function() {
  it('accepts missing object', () => chai.assert.isFalse(tags.isStuck(null)));

  it('accepts missing tags', () => chai.assert.isFalse(tags.isStuck({})));

  it('accepts empty tags', () => chai.assert.isFalse(tags.isStuck({tags: {}})));

  it('ignores other tags', () => chai.assert.isFalse(tags.isStuck({tags: {yo: {name: 'Yo', value: 'ho ho'}}})));

  it('ignores nonstuck status', () => chai.assert.isFalse(tags.isStuck({tags: {status: {name: 'Status', value: 'making progress'}}})));

  it('matches stuck status', () => chai.assert.isTrue(tags.isStuck({tags: {status: {name: 'Status', value: 'stuck'}}})));

  return it('matches verbose stuck status', () => chai.assert.isTrue(tags.isStuck({tags: {status: {name: 'Status', value: 'Stuck to the wall'}}})));
});

describe('canonicalTags', function() {

  it('fills entries', function() {
    const pre = Date.now();
    const {foo, baz} = tags.canonicalTags([{name: 'Foo', value: 'bar'}, {name: 'BaZ', value: 'qux'}], 'Torgen');
    chai.assert.include(foo, {name: 'Foo', value: 'bar', touched_by: 'torgen'});
    chai.assert.isAtLeast(foo.touched, pre);
    chai.assert.include(baz, {name: 'BaZ', value: 'qux', touched_by: 'torgen'});
    return chai.assert.isAtLeast(baz.touched, pre);
  });

  it('preserves touched', function() {
    const pre = Date.now() - 5;
    return chai.assert.deepEqual(
      tags.canonicalTags([{name: 'Foo', value: 'bar', touched: pre}], 'torgen'),
      {foo: {name: 'Foo', value: 'bar', touched: pre, touched_by: 'torgen'}});
  });

  return it('preserves touched_by', function() {
    const {foo} = tags.canonicalTags([{name: 'Foo', value: 'bar', touched_by: 'cscott'}], 'torgen');
    return chai.assert.include(foo, {name: 'Foo', value: 'bar',  touched_by: 'cscott'});
});
});
