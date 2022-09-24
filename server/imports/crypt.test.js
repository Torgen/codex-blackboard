// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { crypt, decrypt } from './crypt.js';
import { TextEncoder } from 'util';
import chai from 'chai';

const plain = 'Oops was brought to you by erasers: don\'t make a mistake without one';
const password = 'Square One Television';

describe('crypt', function() {
  it('encrypts', function() {
    const cipher = crypt(plain, password);
    return chai.assert.notDeepEqual(new TextEncoder().encode(plain), cipher);
  });

  return it('decrypts to original', function() {
    const cipher = crypt(plain, password);

    return chai.assert.equal(plain, decrypt(cipher, password));
  });
});