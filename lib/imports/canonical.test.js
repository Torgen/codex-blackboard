// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import canonical from './canonical.js';
import chai from 'chai';

const testcase = (before, after) => describe(before, function() {
  it(`canonicalizes to ${after}`, () => chai.assert.equal(canonical(before), after));
  return it('is idempotent', () => chai.assert.equal(canonical(canonical(before)), canonical(before)));
});

describe('canonical', function() {
  describe('strips whitespace', function() {
    testcase('  leading', 'leading');
    testcase('trailing  ', 'trailing');
    return testcase('_id', 'id');
  });

  describe('converts to lowercase', () => testcase('HappyTime', 'happytime'));

  describe('converts space to underscore', function() {
    testcase('sport of princesses', 'sport_of_princesses');
    return testcase('sport  of  princesses', 'sport_of_princesses');
  });

  describe('converts non-alphanumeric to underscore', function() {
    testcase("Whomst'd've", 'whomst_d_ve');
    testcase('ca$h', 'ca_h');
    testcase('command.com', 'command_com');
    return testcase('2chainz', '2chainz');
  });

  describe('deletes possessive and contraction apostrophes', function() {
    testcase("bill's", 'bills');
    return testcase("don't", 'dont');
  });

  describe('removes accents', function() {
    testcase('Olá, você aí', 'ola_voce_ai');
    // Đ is a distinct letter from D in vietnamese, not D with a diacritic
    return testcase('Đó là một ngày tháng tư sáng lạnh', 'o_la_mot_ngay_thang_tu_sang_lanh');
  });

  describe('flags', function() {
    testcase('Oh 🇨🇦!', 'oh_🇨🇦');
    return testcase('🏴‍☠️ Yo ho ho!', '🏴‍☠️_yo_ho_ho');
  });

  describe('emoji', function() {
    // emoji-named puzzles from recent hunts
    testcase('✏️✉️➡️3️⃣5️⃣1️⃣➖6️⃣6️⃣6️⃣➖6️⃣6️⃣5️⃣5️⃣', '✏️✉️➡️351➖666➖6655');
    testcase('🤔', '🤔');
    testcase('🔔🦇🦇🦇', '🔔🦇🦇🦇');
    testcase('❤️ & ☮️', '❤️_☮️');
    return testcase('★', '★');
  });

  return it('allows specifying replacement string', () => chai.assert.equal(canonical('  leading and trailing  ', '-'), 'leading-and-trailing'));
});
