// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import chai from 'chai';

export var waitForDocument = async function(collection, query, matcher) {
  let handle = null;
  const cursor = (() => { try {
    return collection.find(query);
  } catch (error) {} })();
  try {
    return await new Promise((resolve, reject) => handle = cursor.observe({
      added(doc) {
        if (matcher != null) {
          try {
            chai.assert.deepInclude(doc, matcher);
            return resolve(doc);
          } catch (err) {
            return reject(err);
          }
        } else { return resolve(doc); }
      }
    }));
  } finally {
    handle.stop();
  }
};

// Returns a promise that resolves when the given object is deleted from the given
// collection. You have to call this while the row exists, then do the thing that
// deletes it, or the promise will reject.
export var waitForDeletion = function(collection, _id) {
  let p;
  let handle = null;
  return p = new Promise(function(resolve, reject) {
    let found = false;
    handle = collection.find({_id}).observe({
      added() {
        return found = true;
      },
      removed() {
        handle.stop();
        return resolve();
      }
    });
    if (!found) {
      handle.stop();
      return reject(new Error(`No document with _id ${_id}`));
    }
  });
};
