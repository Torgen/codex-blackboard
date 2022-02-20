'use strict'

import { normalizeText } from 'normalize-text'
import emojiRegex from 'emoji-regex'

# canonical names: lowercases, all non-alphanumerics replaced with '_'
export default canonical = (s, separator='_') ->
  s = normalizeText s
  # suppress 's and 't
  s = s.replace(/[\'\u2019]([st])\b/g, "$1")
  # replace all non-alphanumeric, non-emoji with _
  e = emojiRegex()
  r = new RegExp "#{e.source}|[a-z0-9]", 'g'
  res = []
  prev = null
  while (match = r.exec(s))?
    res.push separator if prev? and match.index > prev
    res.push match[0]
    prev = match[0].length + match.index
  return res.join('')
