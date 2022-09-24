// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// Constants for the calues of callin_type in Callins documents.

import { EqualsString } from './match.js';

export var ANSWER = 'answer';
export var EXPECTED_CALLBACK = 'expected callback';
export var INTERACTION_REQUEST = 'interaction request';
export var MESSAGE_TO_HQ = 'message to hq';

export var IsCallinType = Match.OneOf(EqualsString(ANSWER), EqualsString(EXPECTED_CALLBACK), EqualsString(INTERACTION_REQUEST), EqualsString(MESSAGE_TO_HQ));

export var human_readable = function(type) {
  switch (type) {
    case ANSWER: return 'Answer';
    case EXPECTED_CALLBACK: return 'Expected Callback';
    case INTERACTION_REQUEST: return 'Interaction Request';
    case MESSAGE_TO_HQ: return 'Message to HQ';
    default: return `Unknown type ${type}`;
  }
};

export var abbrev = function(type) {
  switch (type) {
    case ANSWER: return 'A';
    case EXPECTED_CALLBACK: return 'EC';
    case INTERACTION_REQUEST: return 'IR';
    case MESSAGE_TO_HQ: return 'MHQ';
    default: return '?';
  }
};

export var accept_message = function(type) {
  switch (type) {
    case ANSWER: return 'Correct';
    case EXPECTED_CALLBACK: return 'Received';
    default: return 'Accepted';
  }
};

export var reject_message = function(type) {
  switch (type) {
    case ANSWER: return 'Incorrect';
    default: return 'Rejected';
  }
};

export var cancel_message = type => "Cancel";

export var past_status_message = function(status, type) {
  switch (status) {
    case 'cancelled': return "Cancelled";
    case 'accepted': return accept_message(type);
    case 'rejected': return reject_message(type);
    case 'pending': return 'Pending';
  }
};
