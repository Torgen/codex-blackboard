'use strict'

import { crypt, decrypt } from './crypt.coffee'
import { TextEncoder } from 'util'
import chai from 'chai'

plain = 'Oops was brought to you by erasers: don\'t make a mistake without one'
password = 'Square One Television'

describe 'crypt', ->
  it 'encrypts', ->
    cipher = crypt plain, password
    chai.assert.notDeepEqual new TextEncoder().encode(plain), cipher

  it 'decrypts to original', ->
    cipher = crypt plain, password

    chai.assert.equal plain, decrypt cipher, password