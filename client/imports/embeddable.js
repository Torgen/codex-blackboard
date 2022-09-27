import { EmbedPuzzles } from "/lib/imports/settings.js";

export default function embeddable(link) {
  if (!EmbedPuzzles.get()) {
    return false;
  }
  if (!link) {
    return false;
  }
  if (window.location.protocol === "https:" && !link.startsWith("https:")) {
    return false;
  }
  return true;
}
