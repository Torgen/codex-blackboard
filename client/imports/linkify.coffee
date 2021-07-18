'use strict'

# Gruber's "Liberal, Accurate Regex Pattern",
# as amended by @cscott in https://gist.github.com/gruber/249502
urlRE = /\b(?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:\'\".,<>?«»“”‘’])/ig

export default convertURLsToLinksAndImages = (html, id) ->
  linkOrLinkedImage = (url, id) ->
    inner = url
    url = "http://#{url}" unless /^[a-z][\w\-]+:/.test(url)
    if url.match(/(\.|format=)(png|jpg|jpeg|gif)$/i) and id?
      inner = "<img src='#{url}' class='inline-image image-loading' id='#{id}' onload='window.imageScrollHack(this)' />"
    "<a href='#{url}' target='_blank'>#{inner}</a>"
  count = 0
  html.replace urlRE, (url) ->
    linkOrLinkedImage url, "#{id}-#{count++}"
