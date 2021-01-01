'use strict'

import {md5} from '/lib/imports/md5.coffee'

Meteor.loginWithCodex = (nickname, real_name, gravatar, password, callback) ->
  gravatar_md5 = if gravatar then md5(gravatar) else null
  Accounts.callLoginMethod
    methodArguments: [{nickname, real_name, gravatar_md5, password}]
    userCallback: callback
