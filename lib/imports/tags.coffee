'use strict'

import canonical from './canonical.coffee'
import { ObjectWith, NonEmptyString } from './match.coffee'

export getTag = (object, name) -> object?.tags?[canonical(name)]?.value

export isStuck = (object) ->
  object? and /^stuck\b/i.test(getTag(object, 'Status') or '')

export canonicalTags = (tags, who) ->
  check tags, [ObjectWith(name:NonEmptyString,value:Match.Any)]
  now = Date.now()
  result = {}
  (result[canonical(tag.name)] =
    name: tag.name
    value: tag.value
    touched: tag.touched ? now
    touched_by: tag.touched_by ? canonical(who)
  ) for tag in tags
  result
