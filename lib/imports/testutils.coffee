'use strict'

import chai from 'chai'

export waitForDocument = (collection, query, matcher) ->
  handle = null
  try
    await new Promise (resolve, reject) ->
      handle = collection.find(query).observe
        added: (doc) ->
          try
            chai.assert.deepInclude doc, matcher
            resolve doc
          catch err
            reject err
  finally
    handle.stop()