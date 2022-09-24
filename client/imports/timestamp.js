/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import keyword_or_positional from './keyword_or_positional.coffee';

const today_fmt = Intl.DateTimeFormat(navigator.language, {
  hour: 'numeric',
  minute: 'numeric'
}
);
const past_fmt = Intl.DateTimeFormat(navigator.language, {
  hour: 'numeric',
  minute: 'numeric',
  weekday: 'short'
}
);

const timediff = function(seconds, brief) {
  let days, hours, minutes, weeks;
  [minutes, seconds] = [Math.floor(seconds/60), seconds % 60];
  [hours,   minutes] = [Math.floor(minutes/60), minutes % 60];
  [days,    hours  ] = [Math.floor(hours  /24), hours   % 24];
  [weeks,   days   ] = [Math.floor(days   / 7), days    % 7];
  const res = (function() {
    let s = "";
    if (weeks > 0) { s += ` ${weeks} week`; }
    if (weeks > 1) { s += "s"; }
    if (s && brief) { return s; }
    if (days > 0) { s += ` ${days} day`; }
    if (days > 1) { s += "s"; }
    if (s && brief) { return s; }
    if (hours > 0) { s += ` ${hours} hour`; }
    if (hours > 1) { s += "s"; }
    if (s && brief) { return s; }
    if (minutes > 0) { s += ` ${minutes} minute`; }
    if (minutes > 1) { s += "s"; }
    return s;
  })();
  return res.replace(/^\s+/,'');
};

// timestamps
Template.registerHelper('pretty_ts', function(args) {
  args = keyword_or_positional('timestamp', args);
  const {
    timestamp
  } = args;
  if (!timestamp) { return; }
  const style = (args.style || "time");
  switch (style) {
    case "time":
      var diff = (Session.get('currentTime') || Date.now()) - timestamp;
      var d = new Date(timestamp);
      if ((diff > 86400000) || (diff < -86400000)) {
        return past_fmt.format(d);
      }
      return today_fmt.format(d);
    case 'future': case 'brief future': case 'brief_future':
      var brief = (style !== 'future');
      var duration = timestamp - (Session.get('currentTime') || Date.now());
      var seconds = Math.floor(duration/1000);
      if (seconds < 0) { return 'now'; }
      return `in ${timediff(seconds, brief)}`;
    case "duration": case "brief_duration": case "brief duration": case 'seconds_since':
      brief = (style !== 'duration');
      duration = (Session.get('currentTime') || Date.now()) - timestamp;
      seconds = Math.floor(duration/1000);
      if (style === 'seconds_since') { return seconds; }
      if (seconds < -60) { return "in the future"; }
      if (seconds < 60) { return "just now"; }
      return `${timediff(seconds, brief)} ago`;
    default:
      return `Unknown timestamp style: ${style}`;
  }
});
