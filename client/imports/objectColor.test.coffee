'use strict'

import objectColor, {cssColorToHex, hexToCssColor } from './objectColor.coffee'
import chai from 'chai'

describe 'objectColor', ->
  it 'copies color from tag', ->
    obj =
      _id: 'foo'
      tags:
        color:
          value: 'aliceblue'
    chai.assert.equal objectColor(obj), 'aliceblue'

  it 'generates hsl from _id', ->
    obj =
      _id: 'u8JniQ2zqueSykCTm'
    chai.assert.equal objectColor(obj), 'hsl(80, 41.06427291215469%, 37.18000727778937%)'
    
describe 'cssColorToHex', ->
  it 'converts three-hex to six-hex', ->
    chai.assert.equal cssColorToHex('#fa7'), '#ffaa77'

  it 'leaves six-hex alone', ->
    chai.assert.equal cssColorToHex('#f2a67c'), '#f2a67c'

  it 'converts named colors', ->
    chai.assert.equal cssColorToHex('rebeccapurple'), '#663399'
    chai.assert.equal cssColorToHex('lime'), '#00ff00'
    chai.assert.equal cssColorToHex('burlywood'), '#deb887'

  it 'converts hsl', ->
    chai.assert.equal cssColorToHex('hsl(120,100%,50%)'), '#00ff00'
    chai.assert.equal cssColorToHex('hsl(30, 100%, 50%)'), '#ff8000'
    
describe 'hexToCssColor', ->
  it 'converts named colors', ->
    chai.assert.equal hexToCssColor('#663399'), 'rebeccapurple'
    chai.assert.equal hexToCssColor('#f0f8ff'), 'aliceblue'
    chai.assert.equal hexToCssColor('#00ff00'), 'lime'

  it 'leaves unknown colors', ->
    chai.assert.equal hexToCssColor('#66339a'), '#66339a'
    chai.assert.equal hexToCssColor('#f0f8fe'), '#f0f8fe'
    chai.assert.equal hexToCssColor('#00ff0b'), '#00ff0b'
