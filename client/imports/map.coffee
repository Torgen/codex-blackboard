'use strict'

import loader from "@googlemaps/js-api-loader"
import mc from "@googlemaps/markerclusterer"
export Loader = loader.Loader
export MarkerClusterer = mc.MarkerClusterer

export positionOrDefault = (locatedAt, _id) ->
  if locatedAt?
    coords = locatedAt.coordinates
    {lat: coords[1], lng: coords[0]}
  else
    sha = SHA256 _id
    lat_xtra = (parseInt(sha.substring(0,4), 16) - 32768) / 655360
    lng_xtra = (parseInt(sha.substring(4,8), 16) - 32768) / 655360
    {lat: lat_xtra + 30, lng: lng_xtra - 40}
