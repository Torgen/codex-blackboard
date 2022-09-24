import abbrev from './abbrev.coffee'
import chai from 'chai'

describe 'abbrev', ->
  it 'handles empty string', ->
    chai.assert.equal abbrev(''), ''

  it 'returns 3 letters of one word strings', ->
    chai.assert.equal abbrev('helpful'), 'Hel'

  it 'drops punctuation', ->
    chai.assert.equal abbrev('I\'ll'), 'Ill'

  it 'returns all of short one word strings', ->
    chai.assert.equal abbrev('yO'), 'Yo'

  it 'returns initials of multi-word strings', ->
    chai.assert.equal abbrev('Slow Friends'), 'SF'

  it 'elides \'the\'', ->
    chai.assert.equal abbrev('The East Wing'), 'EW'

  it 'elides \'a\'', ->
    chai.assert.equal abbrev('A Modern Palimpsest'), 'MP'

  it 'elides \'an\'', ->
    chai.assert.equal abbrev('An Easy Piece'), 'EP'

  it 'no elision if would be empty', ->
    chai.assert.equal abbrev('The A'), 'TA'

  it 'returns three letters if one word after elision', ->
    chai.assert.equal abbrev('The Answer'), 'Ans'

  it 'lowercases \'with\'', ->
    chai.assert.equal abbrev('Words With Friends'), 'WwF'

  it 'symbolizes \'and\'', ->
    chai.assert.equal abbrev('Time and Tide'), 'T&T'

  it 'symbolizes \'of\'', ->
    chai.assert.equal abbrev('Fear of Clowns'), 'F/C'

  it 'symbolizes \'at\'', ->
    chai.assert.equal abbrev('Encounter at Farpoint'), 'E@F'

  it 'converts number words', ->
    chai.assert.equal abbrev('The Two Towers'), '2T'

  it 'leaves number words split by punctuation', ->
    chai.assert.equal abbrev('The Tw-o Towers'), 'TT'

  it 'ignores commas in number words', ->
    chai.assert.equal abbrev('Six of one, half dozen of the other'), '6/1HD/O'

  it 'preserves digits', ->
    chai.assert.equal abbrev('The 2 Towers'), '2T'

  it 'combines rules', ->
    chai.assert.equal abbrev('Tea with the Walrus and the Carpenter at a beach'), 'TwW&C@B'

  it 'preserves all punctuation words', ->
    chai.assert.equal abbrev('Kick Some @$$'), 'KS@'