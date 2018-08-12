import canonical from './canonical.coffee'
import chai from 'chai'

describe 'canonical', ->
  it 'strips whitespace', ->
    chai.assert.equal canonical('  leading'), 'leading'
    chai.assert.equal canonical('trailing  '), 'trailing'
    chai.assert.equal canonical('_id'), 'id'

  it 'converts to lowercase', ->
    chai.assert.equal canonical('HappyTime'), 'happytime'

  it 'converts space to underscore', ->
    chai.assert.equal canonical('sport of princesses'), 'sport_of_princesses'
    chai.assert.equal canonical('sport  of  princesses'), 'sport_of_princesses'

  it 'converts non-alphanumeric to underscore', ->
    chai.assert.equal canonical("Whomst'd've"), 'whomst_d_ve'
    chai.assert.equal canonical('ca$h'), 'ca_h'
    chai.assert.equal canonical('command.com'), 'command_com'
    chai.assert.equal canonical('2chainz'), '2chainz'

  it 'deletes possessive and contraction apostrophes', ->
    chai.assert.equal canonical("bill's"), 'bills'
    chai.assert.equal canonical("don't"), 'dont'
