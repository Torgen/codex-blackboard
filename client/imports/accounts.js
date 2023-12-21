import md5 from "md5";

export default function (nickname, real_name, gravatar, password, callback) {
  const args = { nickname, real_name, password };
  if (gravatar) {
    args.gravatar_md5 = md5(gravatar);
  }
  Accounts.callLoginMethod({
    methodArguments: [args],
    userCallback: callback,
  });
}
