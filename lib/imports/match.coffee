'use strict'

export StringWithLength = (args) -> Match.Where (x) ->
  check x, String
  if args.min?
    return false if x.length < args.min
  if args.max?
    return false if x.length > args.max
  true

export NonEmptyString = StringWithLength min: 1

# either an id, or an object containing an id
export IdOrObject = Match.OneOf NonEmptyString, Match.Where (o) ->
  typeof o is 'object' and ((check o._id, NonEmptyString) or true)

# This is like Match.ObjectIncluding, but we don't require `o` to be
# a plain object
export ObjectWith = (pattern) ->
  Match.Where (o) ->
    return false if typeof(o) is not 'object'
    Object.keys(pattern).forEach (k) ->
      check o[k], pattern[k]
    true
