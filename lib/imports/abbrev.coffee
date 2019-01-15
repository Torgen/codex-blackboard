'use strict'

special =
  one: '1'
  two: '2'
  three: '3'
  four: '4'
  five: '5'
  six: '6'
  seven: '7'
  eight: '8'
  nine: '9'
  zero: '0'
  at: '@'
  with: 'w'
  of: '/'
  and: '&'

depunctuate = (word) ->
  nw = word.replace(/[^a-zA-Z0-9]/g, '')
  return nw if nw.length
  word

export default abbrev = (txt) ->
  return txt unless txt
  wds = txt.split /[ ,.]/
  fw = for wd in wds
    l = wd.toLowerCase()
    continue unless l.length and l isnt 'a' and l isnt 'an' and l isnt 'the'
    l
  if fw.length is 0
    fw = wds
  if fw.length is 1
    wd = depunctuate fw[0]
    return wd.substring(0,1).toUpperCase() + wd.substring(1, 3).toLowerCase()
  inits = for wd in fw
    if x = special[wd.toLowerCase()]
      x
    else
      depunctuate(wd).substring(0, 1).toUpperCase()
  inits.join ''
