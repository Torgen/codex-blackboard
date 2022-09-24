// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let moveWithinParent;
import canonical from '/lib/imports/canonical.js';
import { collection } from '/lib/imports/collections.js';

export default moveWithinParent = function(id, parentType, parentId, args) {
  try {
    const [query, targetPosition] = (() => {
      if (args.pos != null) {
      return [id, {$add: [args.pos, {$indexOfArray: ["$puzzles", id]}]}];
    } else if (args.before != null) {
      return [{$all: [id, args.before]}, {$indexOfArray: ["$$npuzzles", args.before]}];
    } else if (args.after != null) {
      return [{$all: [id, args.after]}, {$add: [1, {$indexOfArray: ["$$npuzzles", args.after]}]}];
    }
    })();
    const res = Promise.await(collection(parentType).rawCollection().updateOne({_id: parentId, puzzles: query}, [{
      $set: {
        puzzles: { $let: {
          vars: { npuzzles: {$filter: {input: "$puzzles", cond: {$ne: ["$$this", id]}}}
        },
          in: { $let: {
            vars: {targetPosition},
            in: { $concatArrays: [
              {$cond: [{$eq: ["$$targetPosition", 0]}, [], {$slice: ["$$npuzzles", 0, "$$targetPosition"]}]},
              [id],
              {$cond: [{$eq: ["$$targetPosition", {$size: "$$npuzzles"}]}, [], {$slice: ["$$npuzzles", "$$targetPosition", {$subtract: [{$size: "$$npuzzles"}, "$$targetPosition"]}]}]}
            ]
          }
          }
        }
        }
      },
        touched: Date.now(),
        touched_by: canonical(args.who)
      }
    }
    ])
    );
    if (res.modifiedCount === 1) {
      // Because we're not using Meteor's wrapper, we have to do this manually so the updated document is delivered by the subscription before the method returns.
      Meteor.refresh({collection: parentType, id: parentId});
      return true;
    }
  } catch (e) {
    console.log(e);
  }
  return false;
};
