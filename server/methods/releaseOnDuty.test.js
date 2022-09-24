/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.coffee';
import { Messages, Roles } from '/lib/imports/collections.coffee';
import { callAs } from '/server/imports/impersonate.coffee';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('releaseOnduty', function() {

  beforeEach(function() {
    resetDatabase();
    return Roles.insert({
      _id: 'onduty',
      holder: 'torgen',
      claimed_at: 7,
      renewed_at: 7,
      expires_at: 360007
    });
  });

  it('fails without login', () => chai.assert.throws(() => Meteor.call('releaseOnduty')
  , Match.Error));

  it('ends your onduty', function() {
    chai.assert.isTrue(callAs('releaseOnduty', 'torgen'));
    chai.assert.isNotOk(Roles.findOne('onduty'));
    return chai.assert.deepInclude(Messages.findOne({room_name: 'oplog/0'}), {
      nick: 'torgen',
      id: null,
      type: 'roles'
    }
    );
  });

  return it('ignoses someone elses onduty', function() {
    chai.assert.isFalse(callAs('releaseOnduty', 'cjb'));
    chai.assert.deepInclude(Roles.findOne('onduty'), {
      holder: 'torgen',
      claimed_at: 7,
      renewed_at: 7,
      expires_at: 360007
    }
    );
    return chai.assert.isNotOk(Messages.findOne({room_name: 'oplog/0'}));
  });
});
