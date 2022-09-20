
import { INITIAL_CHAT_LIMIT } from '/client/imports/server_settings.coffee'
import { awaitBundleLoaded } from '/client/imports/ui/pages/logistics/logistics_page.coffee'

distToTop = (x) -> Math.abs(x.getBoundingClientRect().top - 110)

closestToTop = ->
  return unless Session.equals 'currentPage', 'blackboard'
  nearTop = $('#bb-tables')[0]
  return unless nearTop
  minDist = distToTop nearTop
  $('#bb-tables table [id]').each (i, e) ->
    dist = distToTop e
    if dist < minDist
      nearTop = e
      minDist = dist
  nearTop

scrollAfter = (x) ->
  nearTop = closestToTop()
  offset = nearTop?.getBoundingClientRect().top
  x()
  if nearTop?
    Tracker.afterFlush ->
      $("##{nearTop.id}").get(0).scrollIntoView
        behavior: 'smooth'

# Router
BlackboardRouter = Backbone.Router.extend
  routes:
    "": "BlackboardPage"
    "graph": "GraphPage"
    "map": "MapPage"
    "edit": "EditPage"
    "rounds/:round": "RoundPage"
    "puzzles/:puzzle": "PuzzlePage"
    "puzzles/:puzzle/:view": "PuzzlePage"
    "chat/:type/:id": "ChatPage"
    "oplogs": "OpLogPage"
    "facts": "FactsPage"
    "statistics": "StatisticsPage"
    "logistics": 'LogisticsPage'
    'callins': 'LogisticsRedirect'
    "projector": "ProjectorPage"

  BlackboardPage: ->
    scrollAfter =>
      @Page "blackboard", "general", "0", true, true
      Session.set
        color: 'inherit'
        canEdit: undefined
        topRight: 'blackboard_status_grid'

  EditPage: ->
    scrollAfter =>
      @Page "blackboard", "general", "0", true, true
      Session.set
        color: 'inherit'
        canEdit: true
        topRight: 'blackboard_status_grid'

  GraphPage: -> @Page 'graph', 'general', '0', false

  MapPage: -> @Page 'map', 'general', '0', false

  LogisticsPage: ->
    @Page 'logistics_page', 'general', '0', true, true
    await awaitBundleLoaded()

  LogisticsRedirect: -> @navigate '/logistics', {trigger: true, replace: true}

  ProjectorPage: -> @Page 'projector', 'general', '0', false

  PuzzlePage: (id, view=null) ->
    @Page "puzzle", "puzzles", id, true, true
    Session.set
      timestamp: 0
      view: view

  RoundPage: (id) ->
    this.goToChat "rounds", id, 0

  ChatPage: (type,id) ->
    id = "0" if type is "general"
    this.Page("chat", type, id, true)

  OpLogPage: ->
    this.Page("oplog", "oplog", "0", false)

  FactsPage: ->
    this.Page("facts", "facts", "0", false)

  StatisticsPage: ->
    this.Page("statistics", "general", "0", false)

  Page: (page, type, id, has_chat, splitter) ->
    old_room = Session.get 'room_name'
    new_room = if has_chat then "#{type}/#{id}" else null
    if old_room isnt new_room
      # if switching between a puzzle room and full-screen chat, don't reset limit.
      Session.set
        room_name: new_room
        limit: INITIAL_CHAT_LIMIT
    Session.set
      splitter: splitter ? false
      currentPage: page
      type: type
      id: id
    # cancel modals if they were active
    $('.modal').modal 'hide'

  urlFor: (type,id) ->
    Meteor._relativeToSiteRootUrl "/#{type}/#{id}"
  chatUrlFor: (type, id) ->
    (Meteor._relativeToSiteRootUrl "/chat#{this.urlFor(type,id)}")

  goTo: (type,id) ->
    this.navigate(this.urlFor(type,id), {trigger:true})

  goToRound: (round) -> this.goTo("rounds", round._id)

  goToPuzzle: (puzzle) ->  this.goTo("puzzles", puzzle._id)

  goToChat: (type, id) ->
    this.navigate(this.chatUrlFor(type, id), {trigger:true})

export default new BlackboardRouter()
