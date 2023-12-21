import canonical from "/lib/imports/canonical.js";
import { collection } from "/lib/imports/collections.js";

export default function (id, parentType, parentId, args) {
  const parent = collection(parentType).findOne({ _id: parentId, puzzles: id });
  const ix = parent?.puzzles?.indexOf(id);
  if (ix == null) {
    return false;
  }
  let npos = ix;
  const npuzzles = parent.puzzles.filter((p) => p !== id);
  if (args.pos != null) {
    npos += args.pos;
    if (npos < 0) {
      return false;
    }
    if (npos > npuzzles.length) {
      return false;
    }
  } else if (args.before != null) {
    npos = npuzzles.indexOf(args.before);
    if (npos < 0) {
      return false;
    }
  } else if (args.after != null) {
    npos = 1 + npuzzles.indexOf(args.after);
    if (npos <= 0) {
      return false;
    }
  } else {
    return false;
  }
  npuzzles.splice(npos, 0, id);
  collection(parentType).update(
    { _id: parentId },
    {
      $set: {
        puzzles: npuzzles,
        touched: Date.now(),
        touched_by: canonical(args.who),
      },
    },
  );
  return true;
}
