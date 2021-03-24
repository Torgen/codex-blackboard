'use strict'

export default isDuplicateError = (error) ->
  error?.name in ['MongoError', 'BulkWriteError'] and error?.code==11000