'use strict'
import { EmbedPuzzles } from '/lib/imports/settings.coffee'

export default embeddable = (link) ->
  return false unless EmbedPuzzles.get()
  return false unless link
  return false if window.location.protocol is 'https:' and not link.startsWith 'https:'
  true
