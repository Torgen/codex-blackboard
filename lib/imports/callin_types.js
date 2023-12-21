// Constants for the calues of callin_type in Callins documents.

import { EqualsString } from "./match.js";

export var ANSWER = "answer";
export var EXPECTED_CALLBACK = "expected callback";
export var INTERACTION_REQUEST = "interaction request";
export var MESSAGE_TO_HQ = "message to hq";

export var IsCallinType = Match.OneOf(
  EqualsString(ANSWER),
  EqualsString(EXPECTED_CALLBACK),
  EqualsString(INTERACTION_REQUEST),
  EqualsString(MESSAGE_TO_HQ)
);

export function human_readable(type) {
  switch (type) {
    case ANSWER:
      return "Answer";
    case EXPECTED_CALLBACK:
      return "Expected Callback";
    case INTERACTION_REQUEST:
      return "Interaction Request";
    case MESSAGE_TO_HQ:
      return "Message to HQ";
    //istanbul ignore next
    default:
      return `Unknown type ${type}`;
  }
}

export function abbrev(type) {
  switch (type) {
    case ANSWER:
      return "A";
    case EXPECTED_CALLBACK:
      return "EC";
    case INTERACTION_REQUEST:
      return "IR";
    case MESSAGE_TO_HQ:
      return "MHQ";
    //istanbul ignore next
    default:
      return "?";
  }
}

export function accept_message(type) {
  switch (type) {
    case ANSWER:
      return "Correct";
    case EXPECTED_CALLBACK:
      return "Received";
    default:
      return "Accepted";
  }
}

export function reject_message(type) {
  switch (type) {
    case ANSWER:
      return "Incorrect";
    default:
      return "Rejected";
  }
}

export var cancel_message = (type) => "Cancel";

export function past_status_message(status, type) {
  switch (status) {
    case "cancelled":
      return "Cancelled";
    case "accepted":
      return accept_message(type);
    case "rejected":
      return reject_message(type);
    case "pending":
      return "Pending";
  }
}
