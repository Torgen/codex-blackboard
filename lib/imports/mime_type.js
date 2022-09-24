'use strict'

# Simplifies cases like image/svg+xml or text/plain;charset=UTF-8
STRIP_PLUS_AND_SEMICOLON = /([^+;]*)(\+.*)?(;.*)?/

# Uppercase match[1][0] and prepend "Google ".
GOOGLE_APPS_PATTERN = /application\/vnd\.google-apps\.(.*)/

# Uppercase match[2] and match[1][0], and concatenate in that order.
MEDIA_PATTERN = /(image|video|audio)\/(.*)/

STATIC_TYPES =
  'application/pdf': "PDF"
  'application/zip': "ZIP"
  'text/plain': "Text"
  'text/html': "HTML"
  'text/x-python': "Python Source"
  'text/javascript': "Javascript Source"
  'application/javascript': "Javascript Source"

export fileType = (mimeType) ->
  mimeType = mimeType.match(STRIP_PLUS_AND_SEMICOLON)[1]
  res = STATIC_TYPES[mimeType]
  return "#{res} File" if res?
  match = mimeType.match GOOGLE_APPS_PATTERN
  if match?
    return "Google #{match[1][0].toUpperCase()}#{match[1].slice(1)}"
  match = mimeType.match MEDIA_PATTERN
  if match?
    return "#{match[2].toUpperCase()} #{match[1][0].toUpperCase()}#{match[1].slice(1)}"
  return "#{mimeType} File"
