'use strict'

export default isDuplicateError = (error) ->
  error?.name in ['MongoError', 'MongoServerError', 'BulkWriteError'] and error?.code==11000
