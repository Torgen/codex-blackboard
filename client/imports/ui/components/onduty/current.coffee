import './current.html'

Template.onduty_current.helpers
  onduty: -> share.model.Roles.findOne 'onduty'
