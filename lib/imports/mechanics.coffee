'use strict'

import canonical from './canonical.coffee'

export mechanics = {}

export class Mechanic
  constructor: (@name) ->
    @canon = canonical @name
    mechanics[@canon] = @
    Object.freeze @

new Mechanic 'Creative Submission'
new Mechanic 'Crossword'
new Mechanic 'Cryptic Clues'
new Mechanic 'Duck Konundrum'
new Mechanic 'Music Identification'
new Mechanic 'Nikoli Variants'
new Mechanic 'NPL Flats'
new Mechanic 'Physical Artifact'
new Mechanic 'Programming'
new Mechanic 'Runaround'
new Mechanic 'Scavenger Hunt'
new Mechanic 'Text Adventure'
new Mechanic 'Video Game'

Object.freeze mechanics

export IsMechanic = Match.Where (x) -> mechanics[x]?
