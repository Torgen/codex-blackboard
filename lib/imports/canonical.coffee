'use strict'

import { normalizeText } from 'normalize-text'

# canonical names: lowercases, all non-alphanumeric, non-emoji replaced with separator, defaulting to '_'
export default canonical = (s, separator='_') ->
  # strip keycaps
  s = s.replace(/([A-Za-z0-9])\uFE0F\u20E3/gu, '$1')
  s = normalizeText s
  # suppress 's and 't
  s = s.replace(/[\'\u2019]([st])\b/g, "$1")
  # replace all non-alphanumeric, non-emoji with _
  s = s.replace(/[^a-z0-9\p{RI}\p{Emoji}\p{EMod}\u200D\uFE0F\u20E3]+/ug, separator).replace(new RegExp("^#{separator}"),'').replace(new RegExp("#{separator}$"),'')
  return s
