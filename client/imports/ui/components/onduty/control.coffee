
import './control.html'
import { Roles } from '/lib/imports/collections.coffee'
import { EXPERT_MODE } from '/client/imports/settings.coffee'

Template.onduty_control.helpers
  imonduty: -> Roles.findOne(_id: 'onduty', holder: Meteor.userId())?
  renewed_at: -> Roles.findOne({_id: 'onduty'}, {fields: renewed_at: 1})?.renewed_at
  expires_at: -> Roles.findOne({_id: 'onduty'}, {fields: expires_at: 1})?.expires_at
  halfdone: ->
    now = Session.get 'currentTime'
    onduty = Roles.findOne({_id: 'onduty'}, {fields: {renewed_at: 1, expires_at: 1}})
    return false unless onduty?
    return now > (onduty.renewed_at + onduty.expires_at) / 2

Template.onduty_control.events
  'click [data-onduty="claim"]': (event, template) ->
    EXPERT_MODE.set true
    current = Roles.findOne('onduty')?.holder ? null
    Meteor.call 'claimOnduty', {from: current}
  'click [data-onduty="release"]': (event, template) ->
    Meteor.call 'releaseOnduty'
  'click [data-onduty="renew"]': (event, template) ->
    Meteor.call 'renewOnduty'
