'use strict'

R = 6371.009 # Radius of the earth in km
Rmi = 3958.761 # Radius of the earth in miles

deg2rad = (deg) ->
  deg * Math.PI / 180

export lng = (geojson) -> geojson.coordinates[0]
export lat = (geojson) -> geojson.coordinates[1]

export distance = (one, two) ->
  [lat1,lon1,lat2,lon2] = [lat(one),lng(one),lat(two),lng(two)]
  dLat = deg2rad(lat2 - lat1) # deg2rad below
  dLon = deg2rad(lon2 - lon1)
  a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  d = Rmi * c # Distance in miles
  return d