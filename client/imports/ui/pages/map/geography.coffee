import md5 from 'md5'

export positionOrDefault = (locatedAt, _id) ->
  if locatedAt?
    coords = locatedAt.coordinates
    {lat: coords[1], lng: coords[0]}
  else
    sha = md5 _id
    lat_xtra = (parseInt(sha.substring(0,4), 16) - 32768) / 655360
    lng_xtra = (parseInt(sha.substring(4,8), 16) - 32768) / 655360
    {lat: lat_xtra + 30, lng: lng_xtra - 40}

export solarLongitude = (timestamp) ->
  # Simplifying assumption: sun is at the prime meridian at noon UTC, e.g. time = 43200000 (mod 86400000)
  timestamp = timestamp % 86400000
  return 180.0 - (timestamp / 240000.0) # west latitude is negative so later times are smaller until wrapping
