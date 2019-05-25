'use strict'
import crypto from 'crypto'

# takes a string and a password string, returns an EJSON binary
export crypt = (data, password) ->
  password = new Buffer password, 'utf8' # encode string as utf8
  encrypt = crypto.createCipher 'aes256', password
  output1 = encrypt.update data, 'utf8', null
  output2 = encrypt.final null
  r = EJSON.newBinary(output1.length + output2.length);
  output1.copy r
  output2.copy r, output1.length
  r

# takes an EJSON binary and a password string, returns a string.
export decrypt = (data, password) ->
  password = new Buffer password, 'utf8' # encode string as utf8
  decrypt = crypto.createDecipher 'aes256', password
  data = new Buffer data; # convert EJSON binary to Buffer
  output = decrypt.update data, null, 'utf8'
  output += decrypt.final 'utf8'
  output
