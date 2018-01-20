# cscott's very simple splitter widget
'use strict'

Splitter = share.Splitter =
  vsize:
    manualResized: false
    get: () -> $('.bb-bottom-right-content').height()
    set: (size, manual) ->
      if not size?
        size = 300
      $('.bb-right-content').css 'padding-bottom', +size + 6
      $('.bb-bottom-right-content').css 'height', +size
      $('.bb-right-content > .bb-splitter-handle').css 'bottom', +size
      Splitter.vsize.manualResized = !!manual
      +size
  hsize:
    manualResized: false
    get: () -> $('.bb-right-content').width()
    set: (size, manual) ->
      SPLITTER_WIDGET_WIDTH = 6 # pixels
      if not size?
        # 300px wide chat
        size = 300
      $('.bb-splitter').css 'padding-right', +size
      $('.bb-splitter > .bb-splitter-handle').css 'right', +size
      $('.bb-right-content').css 'width', +size
      Splitter.hsize.manualResized = !!manual
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
    initialPos = event.pageX
    initialSize = Splitter.hsize.get()
    mouseMove = (event) ->
      newSize = initialSize - (event.pageX - initialPos)
      Splitter.hsize.set newSize, 'manual'
    mouseUp = (event) ->
      pane.removeClass('active')
      $(document).unbind('mousemove', mouseMove).unbind('mouseup', mouseUp)
    pane.addClass('active')
    $(document).bind('mousemove', mouseMove).bind('mouseup', mouseUp)
  handleVEvent: (event, template) ->
    event.preventDefault() # don't highlight text, etc.
    pane = $(event.currentTarget).closest('.bb-right-content')
    initialPos = event.pageY
    initialSize = Splitter.vsize.get()
    mouseMove = (event) ->
      newSize = initialSize - (event.pageY - initialPos)
      Splitter.vsize.set newSize, 'manual'
    mouseUp = (event) ->
      pane.removeClass('active')
      $(document).unbind('mousemove', mouseMove).unbind('mouseup', mouseUp)
    pane.addClass('active')
    $(document).bind('mousemove', mouseMove).bind('mouseup', mouseUp)
