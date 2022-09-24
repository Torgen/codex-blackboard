'use strict'

import {mechanics} from '../lib/imports/mechanics.coffee'

Template.registerHelper 'yourFavoriteMechanic', ->
  Meteor.user().favorite_mechanics?.includes @

Template.registerHelper 'mechanicName', ->
  mechanics[@].name

Template.mechanics.helpers
  mechanics: -> mech for c, mech of mechanics
  isChecked: -> Template.instance().data?.includes @canon

Template.mechanics.events
  'click li a': (event, template) ->
    # Stop the dropdown from closing.
    event.stopPropagation()

Template.puzzle_mechanics.events
  'change input[data-mechanic]': (event, template) ->
    method = if event.currentTarget.checked then 'addMechanic' else 'removeMechanic'
    Meteor.call method, template.data._id, event.currentTarget.dataset.mechanic

Template.favorite_mechanics.events
  'change input[data-mechanic]': (event, template) ->
    method = if event.currentTarget.checked then 'favoriteMechanic' else 'unfavoriteMechanic'
    Meteor.call method, event.currentTarget.dataset.mechanic
