'use strict'

urlRE = /\b(?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:\'\".,<>?«»“”‘’])/ig

linkify = (text) ->
  result = []
  tail_start = 0
  for match from text.matchAll urlRE
    if tail_start < match.index
      result.push {type: 'text', content: text.slice tail_start, match.index}
    tail_start = match.index + match[0].length
    original = match[0]
    url = match[0]
    url = "http://#{url}" unless /^[a-z][\w\-]+:/.test(url)
    result.push {type: 'url', content: {url, original}}
  if tail_start < text.length
    result.push {type: 'text', content: text.slice tail_start}
  return result

export chunk_text = (text) ->
  return [] unless text
  to_prepend = []
  br = [{type: 'break', content: ''}]
  result = []
  # Pass 1: newlines
  for paragraph in text.split /\n|\r\n?/
    result.push to_prepend...
    to_prepend = br
    if paragraph
      # Pass 2: mentions
      tail_start = 0
      for mention from paragraph.matchAll /([\s]|^)@([a-zA-Z0-9_]*)/g
        if mention.index > tail_start or mention[1].length
          interval = paragraph.slice(tail_start, mention.index) + mention[1]
          result.push linkify(interval)...
        result.push {type: 'mention', content: mention[2]}
        tail_start = mention.index + mention[0].length
      result.push linkify(paragraph.slice tail_start)... if tail_start < paragraph.length
  return result

export chunk_html = (html) ->
  div = document.createElement 'div'
  div.innerHTML = html
  result = []
  for child in div.childNodes
    if child.nodeType is Node.TEXT_NODE
      result.push chunk_text(child.textContent)...
    else if child.nodeType is Node.ELEMENT_NODE
      if result.length and result[result.length-1].type is 'html'
        result[result.length-1].content += child.outerHTML
      else
        result.push {type: 'html', content: child.outerHTML}
  return result
