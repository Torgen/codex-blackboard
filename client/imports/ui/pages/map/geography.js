import md5 from "md5";

export function positionOrDefault(locatedAt, _id) {
  if (locatedAt != null) {
    const coords = locatedAt.coordinates;
    return { lat: coords[1], lng: coords[0] };
  } else {
    const sha = md5(_id);
    const lat_xtra = (parseInt(sha.substring(0, 4), 16) - 32768) / 655360;
    const lng_xtra = (parseInt(sha.substring(4, 8), 16) - 32768) / 655360;
    return { lat: lat_xtra + 30, lng: lng_xtra - 40 };
  }
}

export function solarLongitude(timestamp) {
  // Simplifying assumption: sun is at the prime meridian at noon UTC, e.g. time = 43200000 (mod 86400000)
  timestamp = timestamp % 86400000;
  return 180.0 - timestamp / 240000.0; // west latitude is negative so later times are smaller until wrapping
}
