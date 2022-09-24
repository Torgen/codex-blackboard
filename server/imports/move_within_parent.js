import canonical from '/lib/imports/canonical.coffee'
import { collection } from '/lib/imports/collections.coffee'

export default moveWithinParent = (id, parentType, parentId, args) ->
  try
    [query, targetPosition] = if args.pos?
      [id, $add: [args.pos, $indexOfArray: ["$puzzles", id]]]
    else if args.before?
      [{$all: [id, args.before]}, $indexOfArray: ["$$npuzzles", args.before]]
    else if args.after?
      [{$all: [id, args.after]}, $add: [1, $indexOfArray: ["$$npuzzles", args.after]]]
    res = Promise.await collection(parentType).rawCollection().updateOne({_id: parentId, puzzles: query}, [
      $set:
        puzzles: $let:
          vars: npuzzles: $filter: {input: "$puzzles", cond: $ne: ["$$this", id]}
          in: $let:
            vars: {targetPosition}
            in: $concatArrays: [
              {$cond: [{$eq: ["$$targetPosition", 0]}, [], $slice: ["$$npuzzles", 0, "$$targetPosition"]]},
              [id],
              {$cond: [{$eq: ["$$targetPosition", $size: "$$npuzzles"]}, [], $slice: ["$$npuzzles", "$$targetPosition", $subtract: [{$size: "$$npuzzles"}, "$$targetPosition"]]]}
            ]
        touched: Date.now()
        touched_by: canonical(args.who)
    ])
    if res.modifiedCount is 1
      # Because we're not using Meteor's wrapper, we have to do this manually so the updated document is delivered by the subscription before the method returns.
      Meteor.refresh {collection: parentType, id: parentId}
      return true
  catch e
    console.log e
  return false
