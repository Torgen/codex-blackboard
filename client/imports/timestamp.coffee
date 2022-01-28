'use strict'

import keyword_or_positional from '/client/imports/keyword_or_positional.coffee'

today_fmt = Intl.DateTimeFormat navigator.language,
  hour: 'numeric'
  minute: 'numeric'
past_fmt = Intl.DateTimeFormat navigator.language,
  hour: 'numeric'
  minute: 'numeric'
  weekday: 'short'

timediff = (seconds, brief) ->
  [minutes, seconds] = [Math.floor(seconds/60), seconds % 60]
  [hours,   minutes] = [Math.floor(minutes/60), minutes % 60]
  [days,    hours  ] = [Math.floor(hours  /24), hours   % 24]
  [weeks,   days   ] = [Math.floor(days   / 7), days    % 7]
  res = do ->
    s = ""
    s += " #{weeks} week" if weeks > 0
    s += "s" if weeks > 1
    return s if s and brief
    s += " #{days} day" if days > 0
    s += "s" if days > 1
    return s if s and brief
    s += " #{hours} hour" if hours > 0
    s += "s" if hours > 1
    return s if s and brief
    s += " #{minutes} minute" if minutes > 0
    s += "s" if minutes > 1
    return s
  return res.replace(/^\s+/,'')

# timestamps
Template.registerHelper 'pretty_ts', (args) ->
  args = keyword_or_positional 'timestamp', args
  timestamp = args.timestamp
  return unless timestamp
  style = (args.style or "time")
  switch (style)
    when "time"
      diff = (Session.get('currentTime') or Date.now()) - timestamp
      d = new Date timestamp
      if diff > 86400000 or diff < -86400000
        return past_fmt.format d
      today_fmt.format d
    when 'future', 'brief future', 'brief_future'
      brief = (style isnt 'future')
      duration = timestamp - (Session.get('currentTime') or Date.now())
      seconds = Math.floor(duration/1000)
      return 'now' if seconds < 0
      return "in #{timediff seconds, brief}"
    when "duration", "brief_duration", "brief duration", 'seconds_since'
      brief = (style isnt 'duration')
      duration = (Session.get('currentTime') or Date.now()) - timestamp
      seconds = Math.floor(duration/1000)
      return seconds if style is 'seconds_since'
      return "in the future" if seconds < -60
      return "just now" if seconds < 60
      return "#{timediff seconds, brief} ago"
    else
      "Unknown timestamp style: #{style}"
