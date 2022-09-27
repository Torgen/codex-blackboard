import { nameToEmoji } from "gemoji";

// We might consider substituting an <i> tag from
// http://ellekasai.github.io/twemoji-awesome/
// on client-side to render these?  But for server-side storage
// and chat bandwidth, definitely better to have direct unicode
// stored in the DB.
export default (s) =>
  s.replace(/:([+]?[-a-z0-9_]+):/g, (full, name) => nameToEmoji[name] || full);
