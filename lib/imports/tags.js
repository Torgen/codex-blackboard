// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import canonical from './canonical.coffee';
import { ObjectWith, NonEmptyString } from './match.coffee';

export var getTag = (object, name) => object?.tags?.[canonical(name)]?.value;

export var isStuck = object => (object != null) && /^stuck\b/i.test(getTag(object, 'Status') || '');

export var canonicalTags = function(tags, who) {
  check(tags, [ObjectWith({name:NonEmptyString,value:Match.Any})]);
  const now = Date.now();
  const result = {};
  for (let tag of tags) { result[canonical(tag.name)] = {
    name: tag.name,
    value: tag.value,
    touched: tag.touched ?? now,
    touched_by: tag.touched_by ?? canonical(who)
  }
  ; }
  return result;
};
