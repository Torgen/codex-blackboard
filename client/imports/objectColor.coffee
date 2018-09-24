'use strict'

import { getTag } from '../../lib/imports/tags.coffee'

export default colorFromThingWithTags = (thing) ->
  getTag(thing, 'color') or "##{SHA256(thing._id).substring(0,6)}"
