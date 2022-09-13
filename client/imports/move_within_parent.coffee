import canonical from '/lib/imports/canonical.coffee'

export default moveWithinParent = (id, parentType, parentId, args) ->
  parent = share.model.collection(parentType).findOne(_id: parentId, puzzles: id)
  ix = parent?.puzzles?.indexOf(id)
  return false unless ix?
  npos = ix
  npuzzles = (p for p in parent.puzzles when p != id)
  if args.pos?
    npos += args.pos
    return false if npos < 0
    return false if npos > npuzzles.length
  else if args.before?
    npos = npuzzles.indexOf args.before
    return false unless npos >= 0
  else if args.after?
    npos = 1 + npuzzles.indexOf args.after
    return false unless npos > 0
  else
    return false
  npuzzles.splice(npos, 0, id)
  share.model.collection(parentType).update {_id: parentId}, $set:
    puzzles: npuzzles
    touched: Date.now()
    touched_by: canonical(args.who)
  return true
