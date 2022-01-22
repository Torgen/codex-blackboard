'use strict'

import {positionOrDefault} from './map.coffee'
import chai from 'chai'

describe 'positionOrDefault', ->
  it 'returns explicit position', ->
    chai.assert.deepEqual positionOrDefault({type: 'Point', coordinates: [75.5, -20]}, 'sklanch'), {lat: -20, lng: 75.5}

  it 'randomizes unset position', ->
    chai.assert.deepEqual positionOrDefault(undefined, 'sklanch'), {lat: 30.047036743164064, lng: -39.988528442382815}
