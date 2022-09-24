/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let embeddable;
import { EmbedPuzzles } from '/lib/imports/settings.coffee';

export default embeddable = function(link) {
  if (!EmbedPuzzles.get()) { return false; }
  if (!link) { return false; }
  if ((window.location.protocol === 'https:') && !link.startsWith('https:')) { return false; }
  return true;
};
