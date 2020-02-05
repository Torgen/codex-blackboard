'use strict'

import objectColor from './imports/objectColor.coffee'
import abbrev from '/lib/imports/abbrev.coffee'

Template.graph.events
  'click .bb-layout': (event, template) ->
    template.layout? event

Template.graph.onCreated ->
  @subscribe 'all-roundsandpuzzles'
  @adding = new ReactiveVar false
  @import = import('/client/imports/graph.coffee') 

Template.graph.onDestroyed ->
  @rounds?.stop()
  @puzzles?.stop()
  window.removeEventListener 'resize', @layout

Template.graph.onRendered ->
  cytoscape = await @import
  @status = 'idle'
  @cy = cytoscape.default
    container: @$ '.bb-status-graph'
    style: [
      {
        selector: 'node'
        style:
          label: 'data(label)'
      },
      {
        selector: 'edge'
        style:
          'curve-style': 'bezier'
          'target-arrow-shape': 'triangle'
          'target-arrow-color': 'black'
          'line-color': 'black'
      },
      {
        selector: 'node > node'
        style:
          label: 'data(label)'
          width: 'label'
          height: 'label'
          padding: '0.5em'
          'font-size': '1em'
          'text-halign': 'center'
          'text-valign': 'center'
      }
      {
        selector: 'node.meta'
        style:
          'border-width': '2px'
          'border-style': 'solid'
          'border-color': 'data(color)'
          'font-size': '2em'
      }
      {
        selector: 'node.stuck'
        style:
          'background-color': 'yellow'
      },
      {
        selector: 'node.solved'
        style:
          'background-color': 'lime'
      }
    ]
  @cy.userPanningEnabled(false).userZoomingEnabled(false).autounselectify(true)
  @setAspect = =>
    @cy.layoutUtilities desiredAspectRatio: $(window).width() / $(window).height()
  @setAspect()
  startAdding = =>
    if !@adding.get()
      @cy.startBatch()
      @adding.set true
  @layout = (event) =>
    if event?
      @roundChange = true
    if @status is 'idle'
      @status = 'running'
    else
      @status = 'waiting'
      return
    loop
      @setAspect()
      console.log "laying out structure: #{@structure} roundChange: #{@roundChange}"
      lay = @cy.layout
        name: 'fcose'
        randomize: @roundChange
        edgeElasticity: 0.1
        quality: 'proof'
        nodeDimensionsIncludeLabels: true
      p = lay.promiseOn 'layoutstop'
      lay.run()
      await p
      if @status is 'running'
        @status = 'idle'
        break
      else
        @status = 'running'
    @structure = false
    @roundChange = false

  @autorun =>
    if @adding.get()
      @cy.endBatch()
      if @structure
        @layout()
      @adding.set false
  window.addEventListener 'resize', @layout
  addOrMove = (round_id, puzzle_id) =>
    puzz_cy_id = "puzzles_#{puzzle_id}"
    puzz_node = @cy.$id puzz_cy_id
    @structure = true
    if puzz_node.empty()
      @cy.add
        group: 'nodes'
        data:
          id: puzz_cy_id
          parent: round_id
    else
      puzz_node.move parent: round_id
  detach = (round_id, puzzle_id) =>
    puzz_cy_id = "puzzles_#{puzzle_id}"
    puzz_node = @cy.$id puzz_cy_id
    if puzz_node? and puzz_node.parent().id() is round_id
      puzz_node.move parent: null
      @structure = true

  @rounds = share.model.Rounds.find({}, fields: {name: 1, puzzles: 1}).observe
    added: (doc) =>
      startAdding()
      id = "rounds_#{doc._id}"
      @cy.add
        group: 'nodes'
        data:
          id: id
          label: doc.name
      @structure = true
      @roundChange = true
      for puzzle_id in doc.puzzles
        addOrMove id, puzzle_id
    changed: (newDoc, oldDoc) =>
      startAdding()
      id = "rounds_#{newDoc._id}"
      oldPuzzles = new Set oldDoc.puzzles
      newPuzzles = new Set newDoc.puzzles
      for puzzle_id from newPuzzles
        continue if oldPuzzles.has puzzle_id
        addOrMove id, puzzle_id
      for puzzle_id from oldPuzzles
        continue if newPuzzles.has puzzle_id
        detach id, puzzle_id
      if oldDoc.name isnt newDoc.name
        @cy.$id(id).data 'label', newDoc.name
    removed: (doc) =>
      startAdding()
      id = "rounds_#{newDoc._id}"
      for puzzle_id in doc.puzzles
        detach id, puzzle_id
      @cy.remove "##{id}"
      @structure = true
      @roundChange = true
  
  setPuzzleData = (node, doc) =>
    node.data 'label', abbrev doc.name
    .data 'color', objectColor doc
    if doc.puzzles?
      @structure = true if !node.hasClass 'meta'
      node.addClass 'meta'
    else
      @structure = true if node.hasClass 'meta'
      node.removeClass 'meta'
    if doc.solved
      node.addClass 'solved'
    else
      node.removeClass 'solved'
    if share.model.isStuck doc
      node.addClass 'stuck'
    else
      node.removeClass 'stuck'

  ensureNode = (_id) =>
    id = "puzzles_#{_id}"
    node = @cy.$id id
    if node.empty()
      @structure = true
      node = @cy.add
        group: 'nodes'
        data: {id}
    node
    
  @puzzles = share.model.Puzzles.find({}, fields: {name: 1, feedsInto: 1, puzzles: 1, solved: 1, 'tags.color': 1, 'tags.status': 1}).observe
    added: (doc) =>
      startAdding()
      node = ensureNode doc._id
      setPuzzleData node, doc
      for meta in doc.feedsInto
        mn = ensureNode meta
        @structure = true
        @cy.add
          group: 'edges'
          data:
            source: node.data 'id'
            target: mn.data 'id'
    changed: (newDoc, oldDoc) =>
      startAdding()
      node = ensureNode newDoc._id
      setPuzzleData node, newDoc
      oldMetas = new Set oldDoc.feedsInto
      newMetas = new Set newDoc.feedsInto
      for meta from newMetas
        continue if oldMetas.has meta
        mn = ensureNode meta
        @structure = true
        @cy.add
          group: 'edges'
          data:
            source: node.data 'id'
            target: mn.data 'id'
      for meta from oldMetas
        continue if newMetas.has meta
        id = "puzzles_#{meta}"
        @structure = true
        @cy.remove "edge[source=\"#{node.data 'id'}\"][target=\"#{id}\"]"
    removed: (doc) =>
      startAdding()
      @cy.remove "#puzzles_#{doc._id}"
      @structure = true
