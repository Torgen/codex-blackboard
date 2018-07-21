import * as tags from './tags.coffee'
import chai from 'chai'

describe 'getTag', ->
  it 'accepts missing object', ->
    chai.assert.isUndefined tags.getTag null, 'foo'

  it 'accepts missing tags', ->
    chai.assert.isUndefined tags.getTag {}, 'foo'

  it 'accepts empty tags', ->
    chai.assert.isUndefined tags.getTag {tags: []}, 'foo'

  it 'accepts nonmatching tags', ->
    chai.assert.isUndefined tags.getTag {tags: [{name: 'Yo', canon: 'yo', value: 'ho ho'}]}, 'foo'

  it 'accepts matching tags', ->
    chai.assert.equal tags.getTag({tags: [{name: 'Yo', canon: 'yo', value: 'ho ho'}]}, 'yo'), 'ho ho'

  it 'canonicalizes tags', ->
    chai.assert.equal tags.getTag({tags: [{name: 'Yo', canon: 'yo', value: 'ho ho'}]}, 'yO'), 'ho ho'

describe 'isStuck', ->
  it 'accepts missing object', ->
    chai.assert.isFalse tags.isStuck null

  it 'accepts missing tags', ->
    chai.assert.isFalse tags.isStuck {}

  it 'accepts empty tags', ->
    chai.assert.isFalse tags.isStuck {tags: []}

  it 'ignores other tags', ->
    chai.assert.isFalse tags.isStuck {tags: [{name: 'Yo', canon: 'yo', value: 'ho ho'}]}

  it 'ignores nonstuck status', ->
    chai.assert.isFalse tags.isStuck {tags: [{name: 'Status', canon: 'status', value: 'making progress'}]}

  it 'matches stuck status', ->
    chai.assert.isTrue tags.isStuck {tags: [{name: 'Status', canon: 'status', value: 'stuck'}]}

  it 'matches verbose stuck status', ->
    chai.assert.isTrue tags.isStuck {tags: [{name: 'Status', canon: 'status', value: 'Stuck to the wall'}]}

describe 'canonicalTags', ->
  it 'requires list', ->
    chai.assert.throws ->
      tags.canonicalTags null, 'torgen'
    chai.assert.throws ->
      tags.canonicalTags {}, 'torgen'
    chai.assert.deepEqual tags.canonicalTags([], 'torgen'), []

  it 'fills entries', ->
    pre = Date.now()
    [foo, baz] = tags.canonicalTags [{name: 'Foo', value: 'bar'}, {name: 'BaZ', value: 'qux'}], 'Torgen'
    chai.assert.include foo, {name: 'Foo', canon: 'foo', value: 'bar', touched_by: 'torgen'}
    chai.assert.isAtLeast foo.touched, pre
    chai.assert.include baz, {name: 'BaZ', canon: 'baz', value: 'qux', touched_by: 'torgen'}
    chai.assert.isAtLeast baz.touched, pre

  it 'preserves touched', ->
    pre = Date.now() - 5
    chai.assert.deepEqual(
      tags.canonicalTags([{name: 'Foo', value: 'bar', touched: pre}], 'torgen'),
      [{name: 'Foo', canon: 'foo', value: 'bar', touched: pre, touched_by: 'torgen'}])

  it 'preserves touched_by', ->
    [tag] = tags.canonicalTags [{name: 'Foo', value: 'bar', touched_by: 'cscott'}], 'torgen'
    chai.assert.include tag, {name: 'Foo', canon: 'foo', value: 'bar',  touched_by: 'cscott'}
