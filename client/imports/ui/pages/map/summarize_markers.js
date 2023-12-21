const MAX_CIRCLES = 5;

export default function summarize_markers(markers) {
  let fullOffline, fullOnline;
  let summaryOnline, summaryOffline;
  let numOnline = 0;
  let numOffline = 0;
  markers = markers.slice(0);
  markers.sort((a, b) => b.getOpacity() - a.getOpacity()); // Online first, then offline
  for (let marker of markers) {
    if (marker.getOpacity() === 1.0) {
      numOnline++;
    } else {
      numOffline++;
    }
  }
  [fullOnline, fullOffline, summaryOnline, summaryOffline] = [0, 0, 0, 0];
  if (numOnline + numOffline <= MAX_CIRCLES) {
    [fullOnline, fullOffline] = [numOnline, numOffline];
  } else if (numOffline === 0) {
    [fullOnline, summaryOnline] = [MAX_CIRCLES - 1, numOnline - 4];
  } else if (numOnline === 0) {
    [fullOffline, summaryOffline] = [MAX_CIRCLES - 1, numOffline - 4];
  } else if (numOnline === 1) {
    [fullOnline, fullOffline, summaryOffline] = [
      1,
      MAX_CIRCLES - 2,
      numOffline - 3,
    ];
  } else if (numOffline === 1) {
    [fullOnline, summaryOnline, fullOffline] = [
      MAX_CIRCLES - 2,
      numOnline - MAX_CIRCLES + 2,
      1,
    ];
  } else if (numOnline === MAX_CIRCLES - 1) {
    [fullOnline, summaryOffline] = [MAX_CIRCLES - 1, numOffline];
  } else {
    [fullOnline, summaryOnline, summaryOffline] = [
      3,
      numOnline - 3,
      numOffline,
    ];
  }
  const pieces = [];
  for (let marker of markers) {
    let piece = null;
    if (
      (marker.getOpacity() === 1.0 && fullOnline > 0 && fullOnline--) ||
      (marker.getOpacity() < 1.0 && fullOffline > 0 && fullOffline--)
    ) {
      piece = {
        gravatar: marker.getIcon(),
        title: marker.getTitle(),
        onlineness: marker.getOpacity() === 1.0 ? "online" : "offline",
      };
    } else if (marker.getOpacity() === 1.0 && summaryOnline > 0) {
      piece = {
        summary: summaryOnline,
        title: `${summaryOnline} more online`,
        onlineness: "online",
      };
      summaryOnline = 0;
    } else if (marker.getOpacity() < 1.0 && summaryOffline > 0) {
      piece = {
        summary: summaryOffline,
        title: `${summaryOffline} more offline`,
        onlineness: "offline",
      };
      summaryOffline = 0;
    } else {
      continue;
    }
    pieces.push(piece);
  }
  return pieces;
}
