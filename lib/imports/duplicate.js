export default (error) =>
  ["MongoError", "MongoServerError", "BulkWriteError"].includes(error?.name) &&
  error?.code === 11000;
