// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import * as match from './match.coffee';
import chai from 'chai';

describe('NonEmptyString', function() {
  it('rejects empty string', () => chai.assert.throws(() => check('', match.NonEmptyString)
  , Match.Error));

  it('accepts non-empty string', () => chai.assert.doesNotThrow(() => check('foo', match.NonEmptyString)
  , Match.Error));

  return it('rejects non-string', () => chai.assert.throws(() => check({}, match.NonEmptyString)
  , Match.Error));
});

describe('IdOrObject', function() {
  it('rejects empty string', () => chai.assert.throws(() => check('', match.IdOrObject)
  , Match.Error));

  it('accepts empty string', () => chai.assert.doesNotThrow(() => check('foo', match.IdOrObject)
  , Match.Error));

  it('rejects empty object', () => chai.assert.throws(() => check({}, match.IdOrObject)
  , Match.Error));

  it('rejects object without _id', () => chai.assert.throws(() => check({foo: 'bar'}, match.IdOrObject)
  , Match.Error));

  return it('accepts object with _id', () => chai.assert.doesNotThrow(() => check({_id: 'fffff'}, match.IdOrObject)
  , Match.Error));
});

describe('ObjectWith', function() {
  it('matches anything when empty', () => chai.assert.doesNotThrow(() => check({foo: 'bar', baz: 3}, match.ObjectWith({}))
  , Match.Error));

  it('matches parts', () => chai.assert.doesNotThrow(() => check({foo: 'bar', bar: 3}, match.ObjectWith({
    foo: match.NonEmptyString,
    bar: Number
  })
  )
  , Match.Error));

  return it('fails on any submatch failure', () => chai.assert.throws(() => check({foo: '', bar: 3}, match.ObjectWith({
    foo: match.NonEmptyString,
    bar: Number
  })
  )
  , Match.Error));
});
