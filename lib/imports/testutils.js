import chai from "chai";

export async function waitForDocument(collection, query, matcher) {
  const cursor = collection.find(query);
  let handle = null;
  try {
    return await new Promise(
      (resolve, reject) =>
        (handle = cursor.observe({
          added(doc) {
            if (matcher != null) {
              try {
                chai.assert.deepInclude(doc, matcher);
                resolve(doc);
              } catch (err) {
                reject(err);
              }
            } else {
              resolve(doc);
            }
          },
        })),
    );
  } finally {
    handle.stop();
  }
}

// Returns a promise that resolves when the given object is deleted from the given
// collection. You have to call this while the row exists, then do the thing that
// deletes it, or the promise will reject.
export function waitForDeletion(collection, _id) {
  let handle = null;
  return new Promise(function (resolve, reject) {
    let found = false;
    handle = collection.find({ _id }).observe({
      added() {
        found = true;
      },
      removed() {
        handle.stop();
        resolve();
      },
    });
    if (!found) {
      handle.stop();
      reject(new Error(`No document with _id ${_id}`));
    }
  });
}
