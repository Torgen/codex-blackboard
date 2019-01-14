'use strict'

class StorageWrapper
  constructor: (@storage) ->
    @dependencies = {}

  invalidate: (key) ->
    @dependencies[key]?.changed()

  depend: (key) ->
    dep = @dependencies[key]
    dep = @dependencies[key] = new Tracker.Dependency unless dep?
    dep.depend()

  setItem: (key, value) ->
    @storage.setItem key, value
    @invalidate key

  getItem: (key) ->
    @depend key
    @storage.getItem key

export reactiveLocalStorage = new StorageWrapper window.localStorage

export reactiveSessionStorage = new StorageWrapper window.sessionStorage

addEventListener 'storage', (event) ->
  wrapper = null
  if event.storageArea is window.localStorage
    wrapper = reactiveLocalStorage
  else if event.storageArea is window.sessionStorage
    wrapper = reactiveSessionStorage
  else
    throw 'unknown storage area'
  wrapper.invalidate event.key
