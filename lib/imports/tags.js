import canonical from "./canonical.js";
import { ObjectWith, NonEmptyString } from "./match.js";

export var getTag = (object, name) => object?.tags?.[canonical(name)]?.value;

export var isStuck = (object) =>
  object != null && /^stuck\b/i.test(getTag(object, "Status") || "");

export function canonicalTags(tags, who) {
  check(tags, [ObjectWith({ name: NonEmptyString, value: Match.Any })]);
  const now = Date.now();
  const result = {};
  for (let tag of tags) {
    result[canonical(tag.name)] = {
      name: tag.name,
      value: tag.value,
      touched: tag.touched ?? now,
      touched_by: tag.touched_by ?? canonical(who)
    };
  }
  return result;
}
