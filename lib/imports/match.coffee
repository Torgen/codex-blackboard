'use strict'

export NumberInRange = (args) -> Match.Where (x) ->
  check x, Number
  if args.min?
    return false if x < args.min
  if args.max?
    return false if x > args.max
  true

export StringWithLength = (args) -> Match.Where (x) ->
  check x, String
  check x.length, NumberInRange args
  true

export ArrayWithLength = (matcher, args) -> Match.Where (x) ->
  check x, [matcher]
  check x.length, NumberInRange args
  true

export NonEmptyString = StringWithLength min: 1

export ArrayMembers = (arr) -> Match.Where (x) ->
  return false unless arr.length is x.length
  for m, i in arr
    check x[i], m
  true

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
