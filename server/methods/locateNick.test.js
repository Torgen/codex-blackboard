// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects 
import './locateNick.coffee';
import { callAs } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('locateNick', function() {
  let clock = null;

  beforeEach(() => clock = sinon.useFakeTimers({
    now: 7,
    toFake: ['Date']}));

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  it('fails without login', () => chai.assert.throws(() => Meteor.call('locateNick', {
    location: {
      type: 'Point',
      coordinates: [-122.036346,  37.368832]
    },
    timestamp: 5
  }
  )
  , Match.Error));

  it('fails with old params', () => chai.assert.throws(() => callAs('locateNick', 'torgen', {
    lat: 37.368832,
    lng: -122.036346,
    timestamp: 5
  }
  )
  , Match.Error));

  it('fails with non-point', () => chai.assert.throws(() => callAs('locateNick', 'torgen', {
    location: {
      type: 'LineString',
      coordinates: [[-122.036346,  37.368832], [-122.078827, 37.419857]]
    },
    timestamp: 5
  }
  )
  , Match.Error));

  describe('without queue position', function() {
    let id = null;
    beforeEach(function() {
      id = Meteor.users.insert({
        _id: 'torgen',
        located_at: {  // Mountain View, CA
          type: 'Point',
          coordinates: [-122.078827, 37.419857]
        }});
    
      return callAs('locateNick', 'torgen', {
        location: {
          // Sunnyvale, CA
          type: 'Point',
          coordinates: [-122.036346, 37.368832]
        },
        timestamp: 5
      }
      );
    });

    it('leaves public location', () => chai.assert.deepInclude(Meteor.users.findOne(id), {
      located_at: {
        type: 'Point',
        coordinates: [-122.078827, 37.419857]
      }
    }));

    return it('sets private location fields', () => chai.assert.deepInclude(Meteor.users.findOne(id), {
      priv_located: 5,
      priv_located_at: {
        type: 'Point',
        coordinates: [-122.036346, 37.368832]
      },
      priv_located_order: 7
    }
    ));
  });

  return it('leaves existing queue position', function() {
    const id = Meteor.users.insert({
      _id: 'torgen',
      located_at: {  // Mountain View, CA
        type: 'Point',
        coordinates: [-122.078827, 37.419857]
      },
      priv_located_order: 4
    });
  
    callAs('locateNick', 'torgen', {
      location: {
        // Sunnyvale, CA
        type: 'Point',
        coordinates: [-122.036346, 37.368832]
      }
    });

    return chai.assert.deepInclude(Meteor.users.findOne(id), {
      priv_located: 7,
      priv_located_order: 4
    }
    );
  });
});

    
