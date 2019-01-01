During the hunt, there are some tasks that should be delegated to a specific person, rather than done by whoever notices that
they need to be done, because confusion may arise if multiple people try to do the same task; because having someone whose job
it is to do the thing ensures it will be done; and because not everyone should have to be trained in that part of managing the
blackboard. Depending on how quickly the team is working, some of the below jobs can be done by the same person. Being on-call
makes it difficult to dive deeply into a puzzle, as you will frequenty be pulled out of flow to perform the on-call task. As
such, shift lengths should be limited and ideally scheduled in advance so that someone doesn't feel like they spent the entire
hunt e.g. answering phones.

Calling In Answers
==================
The call-in queue is located at the /callins route relative to the blackboard root. There is no direct link there from the
front page, but the sidebar menu that appears when you click the floating button at the bottom left contains a link to it.

Depending on the hunt, the phone number to be called back at by HQ may either be a global setting, or entered with each
call-in. Determine which it is when you go on call, and if necessary enter your phone number in the settings.

A sound will play when a new call-in arrives; you will also get a desktop notification if you enabled them for the "Callins"
event type, which is recommended. A button with three icons at the end of the enswer will copy it to your clipboard, mark the
answer as submitted, and navigate to the puzzle URL in a new tab, from which you should find the link to submit the answer.

Above the list of pending call-ins are a few of the least recently used quips added by solvers. You should choose a funny one
to answer the phone with, as entertaining HQ may make them delay our callbacks less if we call in wrong answers. (At least,
it can't hurt.) If you really don't like one of the quips, you can punt it, which will move it to the bottom of the list
without using it.

Each callin has a green button for if the answer was correct and a red one for if it's wrong. Once you get the call back from
HQ, click the appropriate one. It will notify the appropriate chat rooms, set the answer on the blackboard, and play the "That
was easy!" sound.

As solving a puzzle tends to lead to unlocking puzzles, if you are on call for both callins and adding puzzles, now is a good
time to check if there are any new ones.

Adding Puzzles
==============
Everything in this section can be done either via the UI or the chat bot. To put the UI into edit mode, click the unlock
button in the header. When done, click lock to protect the page. The bot commands can be done in any chat roon, though the
main (ringhunters, unless it was renamed) chat room is best to avoid clogging puzzle chat. All commands are case insensitive
and case preserving, and they normalize punctuation and whitespace. (i.e. use the right capitalization when you create
something, but it doesn't matter when you refer to it later.)

The two types of object are the Puzzle, which is anything with an answer, and the Round, which is a webpage with puzzles
on it. Metapuzzles are a special case of puzzles, which can have other puzzles feed into them.

To add a round using the UI, click the "New Round" button at the top of the table. Using the bot, say: `bot NAME is a new
round`. 

To create a new metapuzzle in a round using the UI, click the "New Meta" button in the round header, which will bring up a
dialog. Using the bot, say: `bot META NAME is a new meta in ROUND NAME`. In the round chat room (which will rarely be used)
you can say `this` instead of the round name.

To create a new puzzle feeding into a meta using the UI, click the "New Puzzle" button in the meta's section footer. Using the
bot, say; `bot PUZZLE NAME is a new puzzle in META NAME`. In the meta's chat room, you can say `this` instead of the meta's
name.

To create a non-meta puzzle in a round that doesn't feed into any metas using the UI, click the caret at the right side of the
"New Meta" button and choose "New uncategorized puzzle" in the dropdown. Using the bot, say: `bot PUZZLE NAME is a new puzzle
in ROUND NAME`. In the round's chat room, you can say `this` instead of the meta's name.

After creating a puzzle, meta, or round, you should set its link to the URL of the puzzle. The blackboard has an algorithm for
guessing the URLs of puzzles, but it may be wrong. To set the link using the UI, click the pencil to the right of the URL next
to the "Hunt Site Link" label in the puzzle's table entry, then paste the URL into the text box. Using the bot, say: `bot set
link for ROUND OR PUZZLE NAME to URL`. In the chat room for the round or puzzle, you can elide the `for ROUND OR PUZZLE NAME`
part.

If a meta has a strongly associated color (e.g. the emotions in the 2018 hunt or the character classes in the 2017 hunt), you
can set its color on the blackboard. Set the color to the fully saturated tone; the blackboard will worry about generating a 
lighter version. Using the UI, click the label with a + icon with the "add a tag" tooltip. Set the name to `color`
(capitalization doesn't matter). You can either set the value to anything CSS recognizes (e.g. a color name, #RRGGBB), or use
the color picker to choose a color. Using the bot, say: `bot set color for ROUND OR PUZZLE NAME to COLOR`. In the chat room
for the round or puzzle, you can elide the `for ROUND OR PUZZLE NAME` part. If you don't choose a color, or the meta doesn't
have a natural one, the blackboard will generate one randomly and uniformly in the dark half of the HSL bi-cone.

If you find out an existing puzzle is a meta, you can mark it as one in the UI by checking the "is Meta" box in its table
entry. Using the bot, say: `bot PUZZLE NAME is a meta`. In the puzzle's chat room, you can call it `this` instead of typing
out its name. If you had marked a puzzle as a meta incorrectly, you can uncheck the "is Meta" box or say: `bot PUZZLE NAME is
not a meta`. In the puzzle's chat room, you can say `this` instead of typing out its name. Both of these will fail if any
puzzles feed into the meta.

To mark an existing puzzle as feeding into a meta using the UI, click the pencil next to the list of metas under the "Feeds
Into" entry in its table entry, then select the meta from the dropdown box. Using the bot, say `bot PUZZLE NAME feeds into
META NAME`. In either the puzzle or meta's chat room, you can say `this` instead of its name. To stop a puzzle from feeding
into a meta, click the pencil next to the list of metas under the "Feeds Into" section, then click the X next to the Meta's
name in the list. Using the bot, say: `bot PUZZLE NAME doesn't feed into META NAME`. As above, you can refer to either as
`this` in its chat room.

If you create a puzzle in error, you can delete it using the UI by clicking the X next to its name. Using the bot, say: `bot
delete puzzle PUZZLE NAME`. Likewise, to delete a round, click the X next to its name, or say: `bot delete round ROUND NAME`.

Unsticking Puzzles
==================
When a puzzle is marked as stuck, the bot will notify the main chat room, and everyone with stuck puzzle notifications turned
on will get a desktop notification. If you're particularly good at finding next steps or extractions, join the puzzle's chat
room via the link in the bot's message. Once you've successfully made progress, you can mark the puzzle as not stuck by saying
`bot unstuck` or by clicking the button in the header. This is probably not a good role to combine with being on-call for
callins or adding new puzzles.
