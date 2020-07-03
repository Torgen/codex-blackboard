'use strict'
# Constants for the calues of callin_type in Callins documents.

export ANSWER = 'answer'
export EXPECTED_CALLBACK = 'expected callback'
export INTERACTION_REQUEST = 'interaction request'
export MESSAGE_TO_HQ = 'message to hq'

export human_readable = (type) ->
  switch type
    when ANSWER then 'Answer'
    when EXPECTED_CALLBACK then 'Expected Callback'
    when INTERACTION_REQUEST then 'Interaction Request'
    when MESSAGE_TO_HQ then 'Message to HQ'
    else "Unknown type #{type}"

export abbrev = (type) ->
  switch type
    when ANSWER then 'A'
    when EXPECTED_CALLBACK then 'EC'
    when INTERACTION_REQUEST then 'IR'
    when MESSAGE_TO_HQ then 'MHQ'
    else '?'

export accept_message = (type) ->
  switch type
    when ANSWER then 'Correct'
    when EXPECTED_CALLBACK then 'Received'
    else 'Accepted'

export reject_message = (type) ->
  switch type
    when ANSWER then 'Incorrect'
    else 'Rejected'

export cancel_message = (type) -> "Cancel"

export past_status_message = (status, type) ->
  switch status
    when 'cancelled' then "Cancelled"
    when 'accepted' then accept_message type
    when 'rejected' then reject_message type
    when 'pending' then 'Pending'
