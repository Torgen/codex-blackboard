'use strict'

import md5 from 'md5'

export default loginWithCodex = (nickname, real_name, gravatar, password, callback) ->
  args = {nickname, real_name, password}
  if gravatar
    args.gravatar_md5 = md5(gravatar)
  Accounts.callLoginMethod
    methodArguments: [args]
    userCallback: callback
