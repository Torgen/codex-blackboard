// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let isDuplicateError;
export default isDuplicateError = error => ['MongoError', 'MongoServerError', 'BulkWriteError'].includes(error?.name) && (error?.code===11000);
