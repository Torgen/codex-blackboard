'use strict'

Meteor.loginWithCodex = (nickname, real_name, gravatar, password, callback) ->
  Accounts.callLoginMethod
    methodArguments: [{nickname, real_name, gravatar, password}]
    userCallback: callback
