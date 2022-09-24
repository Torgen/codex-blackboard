export var computeMessageFollowup = function(prev, curr) {
  let c;
  if (!prev?.classList?.contains("media")) { return false; }
  // Special message types that are never followups
  for (c of ['bb-message-mail', 'bb-message-tweet']) {
    if (prev.classList.contains(c)) { return false; }
    if (curr.classList.contains(c)) { return false; }
  }
  if (prev.dataset.nick !== curr.dataset.nick) { return false; }
  for (c of ['bb-message-pm','bb-message-action','bb-message-system','bb-oplog']) {
    if (prev.classList.contains(c) !== curr.classList.contains(c)) { return false; }
  }
  if (prev.dataset.pmTo !== curr.dataset.pmTo) { return false; }
  return true;
};
