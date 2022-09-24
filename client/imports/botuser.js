/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let botuser;
export default botuser = () => Meteor.users.findOne({bot_wakeup: {$exists: true}}, {sort: {bot_wakeup: -1}});
