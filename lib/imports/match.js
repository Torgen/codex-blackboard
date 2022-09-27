export var NumberInRange = (args) =>
  Match.Where(function (x) {
    check(x, Number);
    if (args.min != null) {
      if (x < args.min) {
        return false;
      }
    }
    if (args.max != null) {
      if (x > args.max) {
        return false;
      }
    }
    return true;
  });

export var StringWithLength = (args) =>
  Match.Where(function (x) {
    check(x, String);
    check(x.length, NumberInRange(args));
    return true;
  });

export var ArrayWithLength = (matcher, args) =>
  Match.Where(function (x) {
    check(x, [matcher]);
    check(x.length, NumberInRange(args));
    return true;
  });

export var NonEmptyString = StringWithLength({ min: 1 });

export var ArrayMembers = (arr) =>
  Match.Where(function (x) {
    if (arr.length !== x.length) {
      return false;
    }
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      check(x[i], m);
    }
    return true;
  });

// either an id, or an object containing an id
export var IdOrObject = Match.OneOf(
  NonEmptyString,
  Match.Where(
    (o) => typeof o === "object" && (check(o._id, NonEmptyString) || true)
  )
);

// This is like Match.ObjectIncluding, but we don't require `o` to be
// a plain object
export var ObjectWith = (pattern) =>
  Match.Where(function (o) {
    if (typeof o === !"object") {
      return false;
    }
    Object.keys(pattern).forEach((k) => check(o[k], pattern[k]));
    return true;
  });

export var EqualsString = (str) => Match.Where((o) => o === str);

// Match on an object unwraps Maybe and Optional and allows either absent or matching the pattern.
// If you want to allow null, use this.
export var OptionalKWArg = (x) => Match.Maybe(Match.Maybe(x));
