// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import {positionOrDefault, solarLongitude} from './geography.coffee';
import chai from 'chai';

describe('positionOrDefault', function() {
  it('returns explicit position', () => chai.assert.deepEqual(positionOrDefault({type: 'Point', coordinates: [75.5, -20]}, 'sklanch'), {lat: -20, lng: 75.5}));

  return it('randomizes unset position', () => chai.assert.deepEqual(positionOrDefault(undefined, 'sklanch'), {lat: 29.957225036621093, lng: -40.023388671875}));
});

describe('solarLongitude', function() {
  it('is over Greenwich', () => chai.assert.equal(solarLongitude(1645876800000), 0));

  it('is over California', () => chai.assert.equal(solarLongitude(1645905600000), -120));

  return it('is over Japan', () => chai.assert.equal(solarLongitude(1645844439000), 134.8375));
});
