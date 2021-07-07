'use strict'

export default keyword_or_positional = (name, args) ->
  return args.hash unless (not args?) or \
    (typeof(args) is 'string') or (typeof(args) is 'number')
  a = {}
  a[name] = args
  return a
