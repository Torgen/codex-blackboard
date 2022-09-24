// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const R = 6371.009; // Radius of the earth in km
const Rmi = 3958.761; // Radius of the earth in miles

const deg2rad = deg => (deg * Math.PI) / 180;

export var lng = geojson => geojson.coordinates[0];
export var lat = geojson => geojson.coordinates[1];

export var distance = function(one, two) {
  const [lat1,lon1,lat2,lon2] = [lat(one),lng(one),lat(two),lng(two)];
  const dLat = deg2rad(lat2 - lat1); // deg2rad below
  const dLon = deg2rad(lon2 - lon1);
  const a =
    (Math.sin(dLat / 2) * Math.sin(dLat / 2)) +
    (Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2));

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = Rmi * c; // Distance in miles
  return d;
};