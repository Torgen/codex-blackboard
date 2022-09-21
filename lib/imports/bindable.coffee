export default class BindableEnvironmentVariable extends Meteor.EnvironmentVariable
  bindSingleton: (value) ->
    if @value?
      throw new Error "Can't rebind singleton"
    if DDP._CurrentMethodInvocation.get()?
      throw new Error "Can't bind inside method"
    if DDP._CurrentPublicationInvocation.get()?
      throw new Error "Can't bind inside publish"
    @value = value

  get: ->
    val = super.get()
    if val?
      return val
    return @value
