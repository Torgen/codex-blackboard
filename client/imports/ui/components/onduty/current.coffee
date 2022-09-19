import './current.html'

import { Roles } from '/lib/imports/collections.coffee'

Template.onduty_current.helpers
  onduty: -> Roles.findOne 'onduty'
