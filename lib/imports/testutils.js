import chai from "chai";

export async function waitForDocument(collection, query, matcher) {
  const cursor = collection.find(query);
  // TODO: use Promise.withResolvers() once it's available in Meteor's Node version.
  let settled = false,
    resolve,
    reject;
  const p = new Promise((rs, rj) => {
    resolve = rs;
    reject = rj;
  });
  const handle = await cursor.observeAsync({
    added(doc) {
      if (!settled) {
        settled = true;
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
      }
    },
  });
  try {
    return await p;
  } finally {
    handle.stop();
  }
}

// Returns an object whose deleted field is a promise that resolves when the
// given object is deleted from the given collection. You have to call this
// while the row exists, then do the thing that deletes it, or this will
// reject.
export async function waitForDeletion(collection, _id) {
  let found = false,
    resolve;
  const p = new Promise((rs) => {
    resolve = rs;
  });
  let handle = await collection.find({ _id }).observeAsync({
    added() {
      found = true;
    },
    removed() {
      resolve();
    },
  });
  if (!found) {
    handle.stop();
    throw new Error(`No document with _id ${_id}`);
  }
  return { deleted: p.finally(() => handle.stop()) };
}

export async function assertRejects(p, exception) {
  try {
    await p;
    chai.assert.fail(`Expected to throw ${exception}`);
  } catch (e) {
    chai.assert.instanceOf(e, exception);
  }
}

export async function clearCollections(...collections) {
  if (!Meteor.isTest) {
    throw new Error("Can only clear collections in tests");
  }
  await Promise.all(collections.map((c) => c.removeAsync({})));
}
