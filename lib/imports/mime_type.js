// Simplifies cases like image/svg+xml or text/plain;charset=UTF-8
const STRIP_PLUS_AND_SEMICOLON = /([^+;]*)(\+.*)?(;.*)?/;

// Uppercase match[1][0] and prepend "Google ".
const GOOGLE_APPS_PATTERN = /application\/vnd\.google-apps\.(.*)/;

// Uppercase match[2] and match[1][0], and concatenate in that order.
const MEDIA_PATTERN = /(image|video|audio)\/(.*)/;

const STATIC_TYPES = {
  "application/pdf": "PDF",
  "application/zip": "ZIP",
  "text/plain": "Text",
  "text/html": "HTML",
  "text/x-python": "Python Source",
  "text/javascript": "Javascript Source",
  "application/javascript": "Javascript Source",
};

export function fileType(mimeType) {
  mimeType = mimeType.match(STRIP_PLUS_AND_SEMICOLON)[1];
  const res = STATIC_TYPES[mimeType];
  if (res != null) {
    return `${res} File`;
  }
  let match = mimeType.match(GOOGLE_APPS_PATTERN);
  if (match != null) {
    return `Google ${match[1][0].toUpperCase()}${match[1].slice(1)}`;
  }
  match = mimeType.match(MEDIA_PATTERN);
  if (match != null) {
    return `${match[2].toUpperCase()} ${match[1][0].toUpperCase()}${match[1].slice(
      1,
    )}`;
  }
  return `${mimeType} File`;
}
