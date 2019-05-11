# cscott's very simple splitter widget
'use strict'

import { reactiveLocalStorage } from './imports/storage.coffee'

Splitter = share.Splitter =
  vsize:
    dragging: new ReactiveVar false
    size: new ReactiveVar 300
    get: () -> Math.max(Splitter.vsize.size.get(), 0)
    set: (size, manual) ->
      if not size?
        size = 300
      Splitter.vsize.size.set size
      #$('.bb-right-content').css 'padding-bottom', +size + 6
      #$('.bb-bottom-right-content').css 'height', +size
      #$('.bb-right-content > .bb-splitter-handle').css 'bottom', +size
      #Splitter.vsize.manualResized = !!manual
      +size
  hsize:
    dragging: new ReactiveVar false
    size: new ReactiveVar 300
    get: () -> Math.max(Splitter.hsize.size.get(), 0)
    set: (size, manual) ->
      if not size?
        # 300px wide chat
        size = 300
      Splitter.hsize.size.set size
      #$('.bb-splitter').css 'padding-right', +size
      #$('.bb-splitter > .bb-splitter-handle').css 'right', +size
      #$('.bb-right-content').css 'width', +size
      #Splitter.hsize.manualResized = !!manual
      +size
  handleEvent: (event, template) ->
    console.log event.currentTarget unless Meteor.isProduction
    if $(event.currentTarget).closest('.bb-right-content').length
      this.handleVEvent event, template
    else
      this.handleHEvent event, template
  handleHEvent: (event, template) ->
    event.preventDefault() # don't highlight text, etc.
    pane = $(event.currentTarget).closest('.bb-splitter')
    Splitter.hsize.dragging.set true
    initialPos = event.pageX
    initialSize = Splitter.hsize.get()
    mouseMove = (event) ->
      newSize = initialSize - (event.pageX - initialPos)
      Splitter.hsize.set newSize, 'manual'
    mouseUp = (event) ->
      pane.removeClass('active')
      $(document).unbind('mousemove', mouseMove).unbind('mouseup', mouseUp)
      reactiveLocalStorage.setItem 'splitter.hsize', Splitter.hsize.size.get()
      Splitter.hsize.dragging.set false
    pane.addClass('active')
    $(document).bind('mousemove', mouseMove).bind('mouseup', mouseUp)
  handleVEvent: (event, template) ->
    event.preventDefault() # don't highlight text, etc.
    pane = $(event.currentTarget).closest('.bb-right-content')
    Splitter.vsize.dragging.set true
    initialPos = event.pageY
    initialSize = Splitter.vsize.get()
    mouseMove = (event) ->
      newSize = initialSize - (event.pageY - initialPos)
      Splitter.vsize.set newSize, 'manual'
    mouseUp = (event) ->
      pane.removeClass('active')
      $(document).unbind('mousemove', mouseMove).unbind('mouseup', mouseUp)
      reactiveLocalStorage.setItem 'splitter.vsize', Splitter.vsize.size.get()
      Splitter.vsize.dragging.set false
    pane.addClass('active')
    $(document).bind('mousemove', mouseMove).bind('mouseup', mouseUp)
 
['hsize', 'vsize'].forEach (dim) ->
  Tracker.autorun ->
    x = Splitter[dim]
    return if x.dragging.get()
    console.log "about to set #{dim}"
    val = reactiveLocalStorage.getItem "splitter.#{dim}"
    return unless val?
    x.set val

Template.horizontal_splitter.helpers
  hsize: -> Splitter.hsize.get()

Template.horizontal_splitter.events
  'mousedown .bb-splitter-handle': (e,t) -> Splitter.handleEvent(e,t)

Template.horizontal_splitter.onCreated ->
  $('html').addClass('fullHeight')

Template.horizontal_splitter.onRendered ->
  $('html').addClass('fullHeight')

Template.horizontal_splitter.onDestroyed ->
  $('html').removeClass('fullHeight')
