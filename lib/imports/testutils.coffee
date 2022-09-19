'use strict'

import chai from 'chai'

export waitForDocument = (collection, query, matcher) ->
  handle = null
  cursor = try
    collection.find(query)
  try
    await new Promise (resolve, reject) ->
      handle = cursor.observe
        added: (doc) ->
          if matcher?
            try
              chai.assert.deepInclude doc, matcher
              resolve doc
            catch err
              reject err
          else resolve doc
      console.log 'handle must be assigned'
  finally
    handle.stop()

# Returns a promise that resolves when the given object is deleted from the given
# collection. You have to call this while the row exists, then do the thing that
# deletes it, or the promise will reject.
export waitForDeletion = (collection, _id) ->
  handle = null
  p = new Promise (resolve, reject) ->
    found = false
    handle = collection.find({_id}).observe
      added: ->
        found = true
      removed: ->
        handle.stop()
        resolve()
    if !found
      handle.stop()
      reject new Error("No document with _id #{_id}")
