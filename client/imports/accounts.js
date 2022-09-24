// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let loginWithCodex;
import md5 from 'md5';

export default loginWithCodex = function(nickname, real_name, gravatar, password, callback) {
  const args = {nickname, real_name, password};
  if (gravatar) {
    args.gravatar_md5 = md5(gravatar);
  }
  return Accounts.callLoginMethod({
    methodArguments: [args],
    userCallback: callback
  });
};
