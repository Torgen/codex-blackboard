import * as tags from './tags.coffee'
import chai from 'chai'

describe 'getTag', ->
  it 'accepts missing object', ->
    chai.assert.isUndefined tags.getTag null, 'foo'

  it 'accepts missing tags', ->
    chai.assert.isUndefined tags.getTag {}, 'foo'

  it 'accepts empty tags', ->
    chai.assert.isUndefined tags.getTag {tags: {}}, 'foo'

  it 'accepts nonmatching tags', ->
    chai.assert.isUndefined tags.getTag {tags: yo: {name: 'Yo', value: 'ho ho'}}, 'foo'

  it 'accepts matching tags', ->
    chai.assert.equal tags.getTag({tags: yo: {name: 'Yo', value: 'ho ho'}}, 'yo'), 'ho ho'

  it 'canonicalizes tags', ->
    chai.assert.equal tags.getTag({tags: yo: {name: 'Yo', value: 'ho ho'}}, 'yO'), 'ho ho'

describe 'isStuck', ->
  it 'accepts missing object', ->
    chai.assert.isFalse tags.isStuck null

  it 'accepts missing tags', ->
    chai.assert.isFalse tags.isStuck {}

  it 'accepts empty tags', ->
    chai.assert.isFalse tags.isStuck {tags: {}}

  it 'ignores other tags', ->
    chai.assert.isFalse tags.isStuck {tags: yo: {name: 'Yo', value: 'ho ho'}}

  it 'ignores nonstuck status', ->
    chai.assert.isFalse tags.isStuck {tags: status: {name: 'Status', value: 'making progress'}}

  it 'matches stuck status', ->
    chai.assert.isTrue tags.isStuck {tags: status: {name: 'Status', value: 'stuck'}}

  it 'matches verbose stuck status', ->
    chai.assert.isTrue tags.isStuck {tags: status: {name: 'Status', value: 'Stuck to the wall'}}

describe 'canonicalTags', ->

  it 'fills entries', ->
    pre = Date.now()
    {foo, baz} = tags.canonicalTags [{name: 'Foo', value: 'bar'}, {name: 'BaZ', value: 'qux'}], 'Torgen'
    chai.assert.include foo, {name: 'Foo', value: 'bar', touched_by: 'torgen'}
    chai.assert.isAtLeast foo.touched, pre
    chai.assert.include baz, {name: 'BaZ', value: 'qux', touched_by: 'torgen'}
    chai.assert.isAtLeast baz.touched, pre

  it 'preserves touched', ->
    pre = Date.now() - 5
    chai.assert.deepEqual(
      tags.canonicalTags([{name: 'Foo', value: 'bar', touched: pre}], 'torgen'),
      foo: {name: 'Foo', value: 'bar', touched: pre, touched_by: 'torgen'})

  it 'preserves touched_by', ->
    {foo} = tags.canonicalTags [{name: 'Foo', value: 'bar', touched_by: 'cscott'}], 'torgen'
    chai.assert.include foo, {name: 'Foo', value: 'bar',  touched_by: 'cscott'}
