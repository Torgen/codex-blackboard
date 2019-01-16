'use strict'

export default embeddable = (link) ->
  return false if share.model.Settings.findOne('embed_puzzles')?.value isnt 'true'
  return false unless link
  return false if window.location.protocol is 'https:' and not link.startsWith 'https:'
  true