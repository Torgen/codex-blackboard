import canonical from "/lib/imports/canonical.js";
import { collection } from "/lib/imports/collections.js";

export default function (id, parentType, parentId, args) {
  try {
    const [query, targetPosition] = (() => {
      if (args.pos != null) {
        return [id, { $add: [args.pos, { $indexOfArray: ["$puzzles", id] }] }];
      } else if (args.before != null) {
        return [
          { $all: [id, args.before] },
          { $indexOfArray: ["$$npuzzles", args.before] },
        ];
      } else if (args.after != null) {
        return [
          { $all: [id, args.after] },
          { $add: [1, { $indexOfArray: ["$$npuzzles", args.after] }] },
        ];
      }
    })();
    const res = Promise.await(
      collection(parentType)
        .rawCollection()
        .updateOne({ _id: parentId, puzzles: query }, [
          {
            $set: {
              touched: Date.now(),
              touched_by: canonical(args.who),
              puzzles: {
                $let: {
                  vars: {
                    npuzzles: {
                      $filter: {
                        input: "$puzzles",
                        cond: { $ne: ["$$this", id] },
                      },
                    },
                  },
                  in: {
                    $let: {
                      vars: { targetPosition },
                      in: {
                        $concatArrays: [
                          {
                            $cond: [
                              { $eq: ["$$targetPosition", 0] },
                              [],
                              { $slice: ["$$npuzzles", 0, "$$targetPosition"] },
                            ],
                          },
                          [id],
                          {
                            $cond: [
                              {
                                $eq: [
                                  "$$targetPosition",
                                  { $size: "$$npuzzles" },
                                ],
                              },
                              [],
                              {
                                $slice: [
                                  "$$npuzzles",
                                  "$$targetPosition",
                                  {
                                    $subtract: [
                                      { $size: "$$npuzzles" },
                                      "$$targetPosition",
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        ]),
    );
    if (res.modifiedCount === 1) {
      // Because we're not using Meteor's wrapper, we have to do this manually so the updated document is delivered by the subscription before the method returns.
      Meteor.refresh({ collection: parentType, id: parentId });
      return true;
    }
  } catch (e) {
    console.log(e);
  }
  return false;
}
