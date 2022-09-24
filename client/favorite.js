'use strict'

Template.favorite.helpers
  favorite: -> @favorites?[Meteor.userId()]

Template.favorite.events
  'click .favorite': (event, template) -> Meteor.call 'unfavorite', @_id
  'click .indifferent': (event, template) -> Meteor.call 'favorite', @_id
