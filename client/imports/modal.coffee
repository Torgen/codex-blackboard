'use strict'

Template.confirmmodal.onCreated ->
  @result = @data.onCancel
Template.confirmmodal.onRendered ->
  @$('#confirmModal .bb-confirm-cancel').focus()
  @$('#confirmModal').modal show: true
Template.confirmmodal.events
  "click .bb-confirm-ok": (event, template) ->
    template.result = template.data.onConfirm
    template.$('#confirmModal').modal 'hide'
  'hidden *': (event, template) -> 
    template.result()

export confirm = (data) ->
  new Promise (resolve) ->
    view = null
    onCancel = ->
      share.Router.off 'route', onCancel
      Blaze.remove view
      resolve false
    onConfirm = ->
      share.Router.off 'route', onCancel
      Blaze.remove view
      resolve true
    view = Blaze.renderWithData(Template.confirmmodal, {data..., onCancel, onConfirm}, document.body)
