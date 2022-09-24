/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */

import './control.html';
import { Roles } from '/lib/imports/collections.coffee';
import { EXPERT_MODE } from '/client/imports/settings.coffee';

Template.onduty_control.helpers({
  imonduty() { return (Roles.findOne({_id: 'onduty', holder: Meteor.userId()}) != null); },
  renewed_at() { return Roles.findOne({_id: 'onduty'}, {fields: {renewed_at: 1}})?.renewed_at; },
  expires_at() { return Roles.findOne({_id: 'onduty'}, {fields: {expires_at: 1}})?.expires_at; },
  halfdone() {
    const now = Session.get('currentTime');
    const onduty = Roles.findOne({_id: 'onduty'}, {fields: {renewed_at: 1, expires_at: 1}});
    if (onduty == null) { return false; }
    return now > ((onduty.renewed_at + onduty.expires_at) / 2);
  }
});

Template.onduty_control.events({
  'click [data-onduty="claim"]'(event, template) {
    EXPERT_MODE.set(true);
    const current = Roles.findOne('onduty')?.holder ?? null;
    return Meteor.call('claimOnduty', {from: current});
  },
  'click [data-onduty="release"]'(event, template) {
    return Meteor.call('releaseOnduty');
  },
  'click [data-onduty="renew"]'(event, template) {
    return Meteor.call('renewOnduty');
  }
});
