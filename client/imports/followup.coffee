'use strict'

export computeMessageFollowup = (prev, curr) ->
  return false unless prev?.classList?.contains("media")
  # Special message types that are never followups
  for c in ['bb-message-mail', 'bb-message-tweet']
    return false if prev.classList.contains c
    return false if curr.classList.contains c
  return false unless prev.dataset.nick == curr.dataset.nick
  for c in ['bb-message-pm','bb-message-action','bb-message-system','bb-oplog']
    return false unless prev.classList.contains(c) is curr.classList.contains(c)
  return false unless prev.dataset.pmTo == curr.dataset.pmTo
  return true
