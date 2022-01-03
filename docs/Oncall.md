During the hunt, there are some tasks that should be delegated to a specific person, rather than done by whoever notices
that they need to be done, because confusion may arise if multiple people try to do the same task; because having someone
whose job it is to do the thing ensures it will be done; and because not everyone should have to be trained in that part
of managing the blackboard. Depending on how quickly the team is working, some of the below jobs can be done by the same
person. Being on-call makes it difficult to dive deeply into a puzzle, as you will frequently be pulled out of flow to
perform the on-call task. As such, shift lengths should be limited and ideally scheduled in advance so that someone
doesn't feel like they spent the entire hunt e.g. answering phones.

Status Graph
============
If you're solving in a room with a projector or other large communal display, the blackboard has a status graph mode which displays a graphical representation of the team's progress in the hunt. There isn't a link to it from the blackboard itself because for the sake of maximizing display area it has very little UI. You can reach it at the `/graph` path. How to get it onto the display will depend on whether you can use the projector as an additional monitor, or whether it supports casting or Google Hangouts.

First Shift
===========
If you're oncall when the hunt starts, there are some [dynamic settings](Dynamic-Settings.md) you will want to set, as they will improve the experience for yourself, future oncalls, and your solvers. Set them as appropriate as soon as you know the appropriate values.

Calendar Events
===============
(*New for 2022*) If configured to do so, the blackboard will create a Google Calendar which you can add events to. The calendar-with-a-plus icon will allow you to add the calendar to your Google Calendar account. If the calendar was shared  with you, either because you are a member of the appropriate Google group or you were added explicitly by the owner, you will be able to add events to the calendar which will sync to the blackboard. (Calendars are never editable by the public.) If you should be able to edit the calendar and can't, contact whoever owns the machine.)

You can use the calendar for non-puzzle hunt events such as the kickoff, puzzle events which there have been roughly 5 of per year lately, or short-notice post-meta interactions. If an event is associated with a puzzle, the calendar-with-a-plus icon next to `Upcoming Events` in the puzzle's table row can be used to associate them.

Calling In Answers
==================
In the past, called-in answers were confirmed by HQ phoning the team, which allowed manual hint-giving and rate-limiting.
HQ would not repeat the answer on the call (to avoid overhearing spoilers from other teams' calls), so this required the
team member receiving the call to be aware of the call-ins, so they knew what answer was being confirmed. Recent hunts (and
non-MIT hunts) use an automatic answer checker which gives instant feedback with automatic rate-limiting. However, it may
still be a good idea to have an oncall centralize the callins to avoid spamming spurious answers and triggering the
rate-limiting. Also, since a correct answer often unlocks new puzzles, it makes sense that the oncall be aware that this has
happened so they know they need to add the knew puzzles.

The call-in queue is located at the `/callins` route relative to the blackboard root. There is no direct link there from the
front page, but the sidebar menu that appears when you click the floating button at the bottom left contains a link to it.
Also, if you enable notifications for the 'Callins' stream, clicking a callin notification will take you to the callins page.

Even if answers are confirmed automatically, the hunt may still have a global setting for a phone number to contact the team
at. If so,  enter your phone number in the settings when you go on call. Also, saying in the chat room on the callins page,
"I am on call", and starring it (and unstarring any previous declaration) will ensure everyone know someone is doing the job.

A sound will play when a new call-in arrives; you will also get a desktop notification if you enabled them for the 
"Callins" event type, which is recommended. A button with three icons at the end of the answer will copy it to your
clipboard, mark the answer as submitted, and navigate to the puzzle URL in a new tab, from which you should find the link
to submit the answer.

Above the list of pending call-ins are a few of the least recently used quips added by solvers. You should choose a funny
one to answer the phone with, as entertaining HQ may make them delay our callbacks less if we call in wrong answers. (At
least, it can't hurt.) If you really don't like one of the quips, you can punt it, which will move it to the bottom of the
list without using it.

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

Adding Puzzles
==============
Everything in this section can be done either via the UI or the chat bot. To put the UI into edit mode, click the unlock
button in the header. When done, click lock to protect the page. The bot commands can be done in any chat roon, though the
main (ringhunters, unless it was renamed) chat room is best to avoid clogging puzzle chat. All commands are case
insensitive and case preserving, and they normalize punctuation and whitespace. (i.e. use the right capitalization when
you create something, but it doesn't matter when you refer to it later.)

The two types of object are the Puzzle, which is anything with an answer, and the Round, which is a webpage with puzzles
on it. (i.e. Rounds are only for organing the blackboard to match the hunt site.) Metapuzzles are a special case of puzzles,
which can have other puzzles feed into them.

To add a round using the UI, click the "New Round" button at the top of the table. Using the bot, say: `bot NAME is a new
round`. 

To create a new metapuzzle in a round using the UI, click the "New Meta" button in the round header, which will bring up a
dialog. Using the bot, say: `bot META NAME is a new meta in ROUND NAME`. In the round chat room (which will rarely be
used) you can say `this` instead of the round name.

To create a new puzzle feeding into a meta using the UI, click the "New Puzzle" button in the meta's section footer. Using
the bot, say; `bot PUZZLE NAME is a new puzzle in META NAME`. In the meta's chat room, you can say `this` instead of the
meta's name.

To create a non-meta puzzle in a round that doesn't feed into any metas using the UI, click the caret at the right side of
the "New Meta" button and choose "New uncategorized puzzle" in the dropdown. Using the bot, say: `bot PUZZLE NAME is a new
puzzle in ROUND NAME`. In the round's chat room, you can say `this` instead of the meta's name.

Both the new round and new puzzle commands support a `with link X` or `with url X` suffix that explicitly sets the url for the puzzle. If you don't set this explicitly, and someone set the [Puzzle URL Prefix](Dynamic-Settings.md#puzzle-url-prefix) or [Round URL Prefix](Dynamic-Settings.md#round-url-prefix) dynamic settings, the blackboard will attempt to guess the URL based on the puzzle/round name, but it may be wrong. (For example, for some hunts the metapuzzles are under a different path from the leaf puzzles.) If you create a puzzle without explicitly setting the URL and the guess is incorrect, you can set the link one of these ways:
* In edit mode, click the pencil to the right of the URL next to the "Hunt Site Link" label in the puzzle's table entry, then paste the URL into the text box.
* Using the bot, say: `bot set link for ROUND OR PUZZLE NAME to URL`. In the chat room for the round or puzzle, you can elide the `for ROUND OR PUZZLE NAME` part. If those settings weren't set, but you now know that they could be, you might set them now to save yourself trouble later.


After adding a new puzzle, if you have time, try to determine if it has any of the mechanics described on the [Mechanics](Mechanics.md) page. A dropdown with checkboxes for these mechanics is available both in the info pane on the puzzle page, and in the puzzle's table row when in edit mode on the blackboard's top page. (There are no bot commands for managing mechanics.)

If a meta has a strongly associated color (e.g. the emotions in the 2018 hunt or the character classes in the 2017 hunt),
you can set its color on the blackboard. If you don't choose a color, or the meta doesn't have a natural one, the blackboard
will generate one randomly and uniformly in the dark half of the HSL bi-cone. Set the color to the fully saturated tone; the
blackboard will worry about generating a lighter version.
* Using the UI, click the label with a + icon with the "add a tag" tooltip. Set the name to `color` (capitalization doesn't matter).
You can either set the value to anything CSS recognizes (e.g. a color name, #RRGGBB), or use the color picker to choose a color.
* Using the bot, say: `bot set color for ROUND OR PUZZLE NAME to COLOR`. In the chat room for the round or puzzle, you can elide the
`for ROUND OR PUZZLE NAME` part.

If you find out an existing puzzle is a meta, you can mark it as one in the UI by checking the "is Meta" box in its table
entry. Using the bot, say: `bot PUZZLE NAME is a meta`. In the puzzle's chat room, you can call it `this` instead of
typing out its name. If you had marked a puzzle as a meta incorrectly, you can uncheck the "is Meta" box or say: `bot
PUZZLE NAME is not a meta`. In the puzzle's chat room, you can say `this` instead of typing out its name. Both of these
will fail if any puzzles feed into the meta.

To mark an existing puzzle as feeding into a meta using the UI, click the pencil next to the list of metas under the
`Feeds Into` entry in its table entry, then select the meta from the dropdown box. Using the bot, say `bot PUZZLE NAME
feeds into META NAME`. In either the puzzle or meta's chat room, you can say `this` instead of its name. To stop a puzzle
from feeding into a meta, click the pencil next to the list of metas under the "Feeds Into" section, then click the X next
to the Meta's name in the list. Using the bot, say: `bot PUZZLE NAME doesn't feed into META NAME`. As above, you can refer
to either as `this` in its chat room.

If you create a puzzle in error, you can delete it using the UI by clicking the X next to its name. Using the bot, say:
`bot delete puzzle PUZZLE NAME`. Likewise, to delete a round, click the X next to its name, or say: `bot delete round
ROUND NAME`. There is no way of undeleting a puzzle.

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
