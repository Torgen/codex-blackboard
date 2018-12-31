Logging In
==========
The login screen contains the following fields:
* Team Password (required): You should get this from wherever you got the URL for the blackboard site, whether that was
  a classroom blackboard/whiteboard, a Slack channel, or a mailing list.
* Nickname (required): This can be up to 20 characters.
* Real Name (optional): If you don't set this, your nickname will be shown with your chat messages instead.
* Email Address (optional): This is used only to look up your [Gravatar](https://en.gravatar.com/). If you have one and
  want to use it, enter the address of your wordpress.com account here. If you want to make one, go there and create your
  account. If you don't care, a geometric "Wavatar" will be generated based on your nickname and the domain of the hunt site.
  
Individual accounts don't have their own passwords. Everyone is working on the same team, so you are trusted not to
impersonate one another. Similarly, once someone has the team password they can make all the accounts they want, so
someone can't be banned for misbehaving other than by changing the team password and deleting everyone's continuation tokens
from the database.

Notifications
=============
You can opt into desktop notifications by clicking the "Enable Notifications" button at the top of the blackboard. This will
trigger the browser's notification permission dialog. Once you've enabled notifications, you can choose which types of events
you wish to receive notifications for:
* Announcements: General messages for everyone. Enabled by default.
* Answers: A puzzle was correctly answered. The answer will be included in the message. Enabled by default.
* Callins: Someone is requesting an answer be called in for a puzzle. The answer will be included in the message.
  Disabled by default.
* New Puzzles: A puzzle was unlocked. Enabled by default.
* Stuck Puzzles: A puzzle was marked as stuck. Disabled by default.

The Puzzle Page
===============
The default view for every puzzle is three panes: a Google Spreadsheet on the left, some puzzle info on the top right,
and the chatroom on the bottom right. You can resize the panes; your changes will be remembered. Icons in the Breadcrumb entry
for the puzzle in the header let you change the view--you can switch to a Google Doc or the puzzle on the left, make the chat
full height and move the puzzle info to the left, or make the chat take up the whole window. The breadcrumbs also include any
metapuzzles your current puzzle feeds into directly or indirectly, and the top level blackboard.

Solving
-------
Prefer to use the spreadsheet for data entry and solving. The spreadsheet is created from a template that includes a tab with
a grid and a tab with some useful formulas--for example, converting between numbers and letters, and stripping special
characters from a string. If several people want to work on a puzzle offline, leave a chat message so remote people know what's
going on. Click the star on a message to save it.

Tags
----
Puzzles support tags, which are an arbitrary key-value store. Some keys are meaningful:
* Answer: Don't set this directly. See "Answering" below.
* Link: The URL of the puzzle on the hunt site.
* Status: Your current progress. This is displayed on the blackboard. If it starts with "Stuck", a call for help will be
printed in the main chat room and the puzzle will be shaded yellow in the main table and in the status grid.
* Color: Affects the background color of the puzzle info, and for metas, in the blackboard table. Supports any css color name
  or format.
* Cares About: For metapuzzles, a comma-separated list of tag names. The values of these tags for puzzles that feed into this
  meta will be displayed in extra columns of the table in the puzzle info pane.
* Meta *: For metapuzzles, if there is something about the answers to the puzzles that feed into a meta--for example, their
  answers are the names of Barbie's friends and family--you can set it any tag that starts with the word "meta" and it will be
  displayed alongside the tags of all puzzles that feed into the meta on their puzzle pages.
Other tags show up in the main blackboard table and the puzzle info pane, and can be used to remember and communicate
structured info. For examble, you could set "cryptics" to "true" so let people know a puzzle involves cryptic clues.

There is a dialog for setting the status tag to "stuck" that includes information about how you're stuck. For most tags, you
will set them using the chat bot. For example, say `bot set cryptics to true` in the puzzle's chat room.

Answering
---------
Even though every puzzle page has a link to enter an answer on it, don't enter answers yourself. HQ calls back to confirm
answers, and whoever is answering the phone needs to know that a callback is coming. Also, HQ may slow the speed of callbacks
if the team is calling in too many wrong answers to discourage blind guessing. Instead use the callin queue:
`bot call in answer` in the puzzle's chat room. Whoever is oncall will enter the answer and mark your attempt as correct or
not. This also lets them know when they need to check for new puzzles to input. You can mark that an answer was provided
(e.g. because you were given it following a creative exercise) or a backsolve by appending the word "provided" or "backsolve"
to the bot command. If a puzzle answer ends with one of those words, quote the whole answer.

There is also a dialog that calls in an answer, but all it does is enter the appropriate command in the chat room.
