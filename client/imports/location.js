const Rmi = 3958.761; // Radius of the earth in miles

const deg2rad = (deg) => (deg * Math.PI) / 180;

export var lng = (geojson) => geojson.coordinates[0];
export var lat = (geojson) => geojson.coordinates[1];

export function distance(one, two) {
  const [lat1, lon1, lat2, lon2] = [lat(one), lng(one), lat(two), lng(two)];
  const dLat = deg2rad(lat2 - lat1); // deg2rad below
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = Rmi * c; // Distance in miles
  return d;
}
