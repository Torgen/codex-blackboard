import emojify from '/server/imports/emoji.coffee'
import chai from 'chai'

describe 'emojify', ->
  it 'replaces multiple emoji', ->
    chai.assert.equal emojify(':wolf: in a :tophat:'), '🐺 in a 🎩'

  it 'ignores non-emoji', ->
    chai.assert.equal emojify(':fox_face: :capybara: :rabbit:'), '🦊 :capybara: 🐰'
