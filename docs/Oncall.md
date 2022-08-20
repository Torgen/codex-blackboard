During the hunt, there are some tasks that should be delegated to a specific person, rather than done by whoever notices
that they need to be done, because confusion may arise if multiple people try to do the same task; because having someone
whose job it is to do the thing ensures it will be done; and because not everyone should have to be trained in that part
of managing the blackboard. Depending on how quickly the team is working, some of the below jobs can be done by the same
person. Being on-call makes it difficult to dive deeply into a puzzle, as you will frequently be pulled out of flow to
perform the on-call task. As such, shift lengths should be limited and ideally scheduled in advance so that someone
doesn't feel like they spent the entire hunt e.g. answering phones.

Projector Modes
===============
If you're solving in a room with a projector or other large communal display, the blackboard has some visualization modes
for displaying your team's progress. All these paths are relative to the base URL of your site. How to get thgem onto the
display will depend on whether you can use the projector as an additional monitor, or whether it supports casting or
Google Hangouts.
* `/statistics`: (*New for 2023*) A stacked line graph of your number of puzzles unlocked and solved over time.
* `/map`: (*New for 2023*) A map of the world, with the gravatars of your teams members attached to their location.
  Clusters of team members near each other show up as a count; team members who don't give the app location access appear
  clustered in the Atlantic Ocean.
* `/graph`: A hierarchical view of the hunt structure, with boxes representing rounds and ovals representing puzzles. The
  puzzles turn green when solved, and arrows connect puzzles to the metas they feed.
* `/projector`: (*New for 2023*) Rotates between statistics, map, and graph every 10 seconds. In this mode the center of
  the map view will approximately follow the sun.

First Shift
===========
If you're oncall when the hunt starts, there are some [dynamic settings](Dynamic-Settings.md) you will want to set, as they will improve the experience for yourself, future oncalls, and your solvers. Set them as appropriate as soon as you know the appropriate values.

Onduty Role
===========
(*New for 2023*) When you become oncall, you should claim the onduty role. At the top of the blackboard and in the panel above chat on
the Logistics page, a control with a pager icon will show the current onduty, or will turn orange if nobody is onduty. The green hand
button will claim the role, including from someone else.

The info panel above chat on every puzzle page has a read-only version of this control, so that solvers know whether someone is on duty.
If they don't think anyone is on duty, they may call in answers themselves or conflict with each other adding new puzzles, so marking
yourself as on duty makes it clear that these responsibilities are covered. Also, when someone uses `@` or `/msg` in chat, your nickname
will appear at the top of the suggestion box so that solvers can easily get your attention with mentions and private messages.

By default, claiming the on duty role lasts for an hour before expiring automatically. (The duration can be customized with the
[Role Renewal Time](Dynamic-Settings.md#user-content-role-renewal-time) dynamic setting.) If you perform an action commonly associated with the on duty
role while you have the role, such as adding a new puzzle or resolving a callin, your shift will automatically be extended by the role
renewal time from that point. If you have gone half the renewal time without performing such an action, a clock button will appear on the
onduty control to allow you to extend your shift manually, so you don't lose it by surprise. If you know that you will not be able to be
on duty anymore (e.g. you are going to sleep), the door button will relinquish the role.

Even if answers are confirmed automatically, the hunt may still have a global setting for a phone number to contact the team
at. If so, enter your phone number in the settings when you go on call.

Calendar Events
===============
(*New for 2022*) If configured to do so, the blackboard will create a Google Calendar which you can add events to. The calendar-with-a-plus icon will allow you to add the calendar to your Google Calendar account. If the calendar was shared  with you, either because you are a member of the appropriate Google group or you were added explicitly by the owner, you will be able to add events to the calendar which will sync to the blackboard. (Calendars are never editable by the public.) If you should be able to edit the calendar and can't, contact whoever owns the machine.)

You can use the calendar for non-puzzle hunt events such as the kickoff, puzzle events which there have been roughly 5 of per year lately, or short-notice post-meta interactions.

Logistics View
==============
(*New for 2023*) The Logistics view is a dense view of the hunt as a whole, optimized for both quick editing and for directing unattached
solvers to puzzles where their efforts would be most valuable. If you have never been onduty or viewed the Logistics page, you can reach it
from the hamburger menu at the bottom-left of the blackboard. If you have done either, it can be reached from the hand truck icon in the header.

To focus your attention where it is needed, solved metas become transparent. The left border for a puzzle is normally black, yellow if the puzzle
is stuck, or green if it is solved. If anyone is in the Jitsi call for a puzzle, the number of participants will appear in a camera at the right
side of the puzzle. If nobody is in Jitsi but some people are in text chat, the number will appear in a dialog box. If a puzzle you need for a meta
has neither, that's a sign you should direct idle solvers to finish it.

Calling In Answers
==================
In the past, called-in answers were confirmed by HQ phoning the team, which allowed manual hint-giving and rate-limiting.
HQ would not repeat the answer on the call (to avoid overhearing spoilers from other teams' calls), so this required the
team member receiving the call to be aware of the call-ins, so they knew what answer was being confirmed. Recent hunts (and
non-MIT hunts) use an automatic answer checker which gives instant feedback with automatic rate-limiting. However, it may
still be a good idea to have an oncall centralize the callins to avoid spamming spurious answers and triggering the
rate-limiting. Also, since a correct answer often unlocks new puzzles, it makes sense that the oncall be aware that this has
happened so they know they need to add the new puzzles.

When there are any pending callins, the call-in queue appears at the bottom of the Logistics page. If you enable notifications
for the 'Callins' stream, clicking a callin notification will take you to the Logistics page.

A sound will play when a new call-in arrives; you will also get a desktop notification if you enabled them for the 
"Callins" event type, which is recommended. A button with three icons at the end of the answer will copy it to your
clipboard, mark the answer as submitted, and navigate to the puzzle URL in a new tab, from which you should find the link
to submit the answer.

Each callin has a green button for if the answer was correct and a red one for if it's wrong. Once you get the call back 
from HQ, click the appropriate one. It will notify the appropriate chat rooms, set the answer on the blackboard, and play
the "That was easy!" sound.

As solving a puzzle tends to lead to unlocking puzzles, if you are on call for both callins and adding puzzles, now is a
good time to check if there are any new ones.

Alternate Call-in Types
-----------------------
Besides answers, there are three other types of call-ins you may see in the queue:
* Interaction Requests may be provided immediately on unlock, or require solving to extract. They may cause HQ to deliver an artifact or pose a creative challenge to the team. Recent hunts have had a separate form to enter these phrases besides the standard answer form, so use that form instead if it is available. If HQ provides a response, such as detailed instructions or a time when the artifact will be delivered, enter it in the provided text box before marking the request as accepted or refused.
* Messages to HQ are for any other kind of contact, which may include spending hint currency or reporting an apparent error in a puzzle. Recent hunts have had a separate form to enter these messages, so use it if applicable. You may have to interpret this message rather than simply pasting it into the form.
* Expected Callbacks are for when HQ will be contacting you without you having to do something. For example, if HQ assigned the team a creative task with a Dropbox to submit it to, the team may submit to that dropbox directly, then use this call-in type to tell you that they have done so.

Managing Rounds/Puzzles
=======================
Everything in this section can be done from the Logistics page, from the main blackboard in edit mode, or via the chat bot.
To put the blackboard into edit mode, click the unlock button in the header. When done, click lock to protect the page.
The bot commands can be done in any chat roon, though the main (ringhunters, unless it was renamed) chat room is best to
avoid clogging puzzle chat. All commands are case insensitive and case preserving, and they normalize punctuation and
whitespace. (i.e. use the right capitalization when you create something, but it doesn't matter when you refer to it later.)

The two types of object are the Puzzle, which is anything with an answer, and the Round, which is a webpage with puzzles
on it. (i.e. Rounds are only for organing the blackboard to match the hunt site.) Metapuzzles are a special case of puzzles,
which can have other puzzles feed into them.

To create a round
-----------------
* From the Logistics page, drag a link to the round from the hunt site onto the "Round" button in the "+ New"
section at the top left. The round's name will be the text of the link. You can create a round without a URL by clicking the
Round button and typing the name in the text area. (If the [Round URL Prefix](Dynamic-Settings.md#user-content-round-url-prefix) dynamic
setting is set, blackboard will attempt to guess the URL from the name.)
* Using the Blackboard's edit mode, click the "New Round" button at the top of the table. You can edit the URL under the round's tags.
* Using the bot, say: `bot NAME is a new round`. If you know the URL, you can add `with url X` to the command to set it.

To create a new metapuzzle
--------------------------
* On the Logistics page, drag a link to the puzzle from the hunt site onto the "Meta" button in the "+ New" section at the
top left, then drop it onto the name of the round the Metapuzzle belongs to. The name of the metapuzzle will be the text of
the link. You can create a metapuzzle without a URL by clicking the Meta button, then clicking the round name in the dropdown.
(If the [Puzzle URL Prefix](Dynamic-Settings.md#user-content-puzzle-url-prefix) dynamic setting is set, blackboard will attempt to guess
the URL from the puzzle name.)
* Using the Blackboard's edit mode, click the "New Meta" button in the round header and type the puzzle's name in the focused
text box. You can edit the URL under the tags.
* Using the bot, say: `bot META NAME is a new meta in ROUND NAME`. In the round chat room (which will rarely be used) you can
say `this` instead of the round name. If you know the URL, you can add `with url X` to the command to set it.

To create a new puzzle feeding into a meta
------------------------------------------
* Using the Logistics page, drag a link to the puzzle onto the meta. The name of the puzzle will be the text of the link. To
create a puzzle without a URL, click the "+ puzzle" button in the corner of the meta. (If the
[Puzzle URL Prefix](Dynamic-Settings.md#user-content-puzzle-url-prefix) dynamic setting is set, blackboard will attempt to guess
the URL from the puzzle name.)
* Using the Blackboard's edit mode, click the "New Puzzle" button in the meta's section footer. You can edit the URL under the
new puzzle's tags.
* Using the bot, say; `bot PUZZLE NAME is a new puzzle in META NAME`. In the meta's chat room, you can say `this` instead of the
meta's name. If you know the URL, you can add `with url X` to the command to set it.

To create a non-meta puzzle that doesn't feed into any metas
------------------------------------------------------------
* Using the logistics page, drag a link to the puzzle from the hunt site onto the Puzzle button in the "+ New" section at the
top left, then drop it on the round to create the puzzle in. The name of the puzzle will be the text of the link. To create a
puzzle without a URL, click the "+ puzzle" button in the corner of the meta. (If the
[Puzzle URL Prefix](Dynamic-Settings.md#user-content-puzzle-url-prefix) dynamic setting is set, blackboard will attempt to guess the URL
from the puzzle name.)
* Using the Blackboard's edit mode, click the caret at the right side of the "New Meta" button and choose
"New uncategorized puzzle" in the dropdown. You can edit the URL in the new puzzle's tags.
* Using the bot, say: `bot PUZZLE NAME is a new puzzle in ROUND NAME`. In the round's chat room, you can say `this` instead
of the meta's name. If you know the URL, you can add `with url X` to the command to set it.

To make a puzzle feed into a meta
---------------------------------
Sometimes when you unlock a puzzle you don't know which meta(s) it feeds into. If you determine that later:
* Using the logistics page, drag the puzzle onto the meta it feeds into. A puzzle can feed multiple metas, so you can drag from
another meta.
* Using the Blackboard's edit mode, select the meta from the dropdown in the `Feeds Into` heading in the tags table
* Using the bot, say `bot PUZZLE NAME feeds into META NAME`. You can replace either `PUZZLE NAME` or `META NAME` with `this` if
you're in the appropriate chat room.

To remove a puzzle from a meta
------------------------------
If a puzzle was incorrectly categorized as feeding a meta:
* Using the logistics page, drag the puzzle from the meta onto empty space. The puzzle will appear blurry if dropping it will remove
it from the meta.
* Using the blackboard's edit mode, click the X next to the meta's name in the `Feeds Into` heading in the tags table.
* Using the bot, say `bot PUZZLE NAME doesn't feed into META NAME`. You can replace either `PUZZLE NAME` or `META NAME` with `this` if
you're in the appropriate chat room.

Editing mechanics and tags
--------------------------
After adding a new puzzle, if you have time, try to determine if it has any of the mechanics described on the [Mechanics](Mechanics.md) page.
* Using the logistics page, when hovering over a puzzle, an edit button will appear at the right side. Clicking it will open a dialog where
you can edit the puzzle's tags, URL, and mechanics. Click the `Mechanics` button to open a dropdown with checkboxes for the known mechanics,
and check all that apply.
* Using the blackboard's edit mode, under the `Mechanics` header of the tag table is the same button. You can also add, delete, and edit other
tags.
* You can't manage mechanics using the bot. You can set tags by saying `bot set TAG for ROUND OR PUZZLE NAME to COLOR`.  In the chat room for
the round or puzzle, you can elide the `for ROUND OR PUZZLE NAME` part.

### Special Tags
* The `answer` tag usually shouldn't be set directly; it is set automatically when an `answer` callin is marked as correct.
* The `status` tag is normally set using the `Mark Stuck` dialog on the puzzle page.
* The `color` tag determines the background color of a round on the blackboard and logistics page. If it isn't set, a color will be chosen based
on the puzzle's randomly-generated ID. Any color recognized by CSS is accepted.

Associating a calendar event with a puzzle
------------------------------------------
If a puzzle has a calendar event associated with it, you can link them. A calendar even can only be linked to one puzzle.
* Using the logistics page, drag a calendar event from the column on the right onto the puzzle it should be associated with.
* Using the blackboard's edit mode, select the calendar event from the dropdown menu under `Upcoming Events` in the puzzle's table row.
* From the puzzle info page, the calendar icon above the puzzle's title opens a dropdown to select from upcoming events.
* You can't manage calendar events using the bot.

Deleting a puzzle
-----------------
Warning: there is no way to undelete a puzzle.
* Using the logistics page, drag the puzzle to the `Delete` button at the top left. You will be asked to confirm.
* Using the Blackboard's edit mode, click the X next to the puzzle's name. You will be asked to confirm.
* Using the bot, say `bot delete puzzle PUZZLE NAME`.

Unsticking Puzzles
==================
When a puzzle is marked as stuck, the bot will notify the main chat room, and everyone with stuck puzzle notifications
turned on will get a desktop notification. If you're particularly good at finding next steps or extractions, join the
puzzle's chat room via the link in the bot's message or by clicking the desktop notification. Once you've successfully made progress, you can mark the puzzle as
not stuck by saying `bot unstuck` or by clicking the button in the header. This is probably not a good role to combine
with being on-call for callins or adding new puzzles.

Announcements
=============
Starring a message in the main chatroom pins it above the puzzles table so that anyone joining the page sees it immediately.
It also generates a notification for anyone who has notification enabled in general and for the `announcements` stream,
which is enabled by default. A single message is only announced once, even if it's unstarred and restarred.

Once a message is obsolete, you can unstar it to remove it from the main pane. To prevent messages from being unstarred
accidentally, you have to be in edit mode (click the unlock icon in the header) to unstar messages in the table panel.
You can always unstar messages in the chat panel, but you have to scroll far enough back in the chat history to find it.

Starring messages in other rooms does not generate an announcement, but does pin that message where it will be easily seen.

Polls
=====
Should we be given a choice at some point, such as which round to unlock, which puzzle to spend a free solve on, or where to get dinner, you can solicit the team's input with a poll. This is a bot command like any other, but because the poll will appear to be said by you, you may want to send it to the bot as a private message to avoid apparent redundancy.
```
/msg bot poll "Who would win?" Me Myself Irene "John Rambo"
```
Quote the question and any options with a space in them. Polls support a minimum of two and a maximum of five options. Like any chat message, a poll can be starred.
