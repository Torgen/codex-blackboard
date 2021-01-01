Logging In
==========
The login screen contains the following fields:
* **Team Password** (required): You should get this from wherever you got the URL for the blackboard site, whether that was
  a classroom blackboard/whiteboard, a Slack channel, or a mailing list.
* **Nickname** (required): This can be up to 20 characters.
* **Real Name** (optional): If you don't set this, your nickname will be shown with your chat messages instead.
* **Email Address** (optional): This is used only to look up your [Gravatar](https://en.gravatar.com/). It is never sent to
  the server or shared with teammates. If you don't have a Gravatar, a geometric "Wavatar" will be generated for you instead.
  
Individual accounts don't have their own passwords. You are trusted not to impersonate one another.
Be careful with the team password.  A bad actor can freely create accounts, so there is no way to
ban them short of changing the team password and forcing everyone to log in again.

Jitsi Meetings
==============
The main blackboard page and every puzzle page have their own Jitsi meeting. (Unless the operator changed the default settings.)

* When you move between pages on the blackboard, you automatically join the new page's meeting.
  * To pin yourself to a specific meeting, click the pin icon within that meeting.
* By default, you enter meetings with your microphone muted and your camera disabled.
  * To change your mute/video status within a meeting, click on the mic or video icon in that meeting.
  * To change your default mute/video status, click on the **Settings** dropdown menu at the top of any blackboard page, and toggle the appropriate option.
* If you have multiple tabs open, you will only join the meeting for one of them.
  * Clicking the video button in the chat line will join that meeting and hang up from the active meeting from any other tag.

Favorite Puzzles and Mechanics
==============================
Selecting one or more mechanics from the **Favorite Mechanics** dropdown at the top of the blackboard will cause puzzles which are marked as involving any of those mechanics to appear in a special **Favorite Puzzles** section above all other rounds. A summary of the meaning of each mechanic can be found [here](./Mechanics.md). If you **Enable Notifications**, you can be notified when a puzzle is marked as involving any of those mechanics.

Regardless of mechanics, you can make any puzzle show up in the **Favorite Puzzles** section by clicking the heart either in its grid row or on the info panel on its puzzle page. 

In the **Settings** dropdown, enabling **Hide Solved Favorites** will exclude solved puzzles from appearing in the **Favorite Puzzles** section.

Notifications
=============
You can opt into desktop notifications by clicking the **Enable Notifications** button at the top of the blackboard. This
will trigger the browser's notification permission dialog. Once you've enabled notifications, you can choose which types
of events you wish to receive notifications for:
* **Announcements**: General messages for everyone. Enabled by default.
* **Answers**: A puzzle was correctly answered. The answer will be included in the message. Clicking this notification will take you to the puzzle page. Enabled by default.
* **Callins**: Someone is requesting an answer be called in for a puzzle. The answer will be included in the message. Clicking this notification will take you to the **Call-Ins** page.  Disabled by default.
* **New Puzzles**: A puzzle was unlocked. Clicking this notification will take you to the puzzle page. Disabled by default.
* **Stuck Puzzles**: A puzzle was marked as stuck. Clicking this notification will take you to the puzzle page. Disabled by default.
* **Favorite Mechanics**: A puzzle has been marked as using one of your **Favorite Mechanics**. Clicking this notification will take you to the puzzle page. Enabled by default.

Main Chat
=========
The header on almost every page includes a mini summary of the main chat room. The **more** link will expand that room to
fill your window; there is also a link to pop out the chat, which may be preferable if you have a large enough screen. The
dialogue icon in the Blackboard breadcrumb will also take you to the main chat room.

If you're not sure what you should be doing, this is a good place to ask.

Shut up, Bot!
-------------
The bot has some just-for-fun plugins installed, like a meme generator. If you would rather not see these messages, the
**Settings** dropdown contains a **Mute Bot Tomfoolery** option that will hide them. This doesn't affect important messages like responses to commands.

Quips
-----
Quips are funny things to say when we answer phone calls from HQ. We do this because HQ should have fun too.
It also encourages HQ to not delay our callbacks too much if we call in a bunch of wrong answers.  You
can add a quip to the queue two ways:

* At the `/quips/new` route relative to the root of the blackboard
* Asking the bot to do it. For example, `bot new quip Codex is my co-dump stat`.

The list of quips is shown to whomever is manning the call-in queue. Whoever is manning the call-in queue will be given
a selection of not-recently-used quips to choose from.

The Puzzle Page
===============
The default view for every puzzle is three panes: a Google Spreadsheet on the left, some puzzle info on the top right,
and the chatroom on the bottom right. You can resize the panes; your changes will be remembered. Icons in the Breadcrumb
entry for the puzzle in the header let you change the view--you can switch to a Google Doc or the puzzle on the left, make
the chat full height and move the puzzle info to the left, or make the chat take up the whole window. The breadcrumbs also
include any metapuzzles your current puzzle feeds into directly or indirectly, and the top level blackboard.
In the spreadsheet, doc, and puzzle info views, a box in the top right corner contains a link to full screen view, which hides the header and all the browser chrome to maximize your solving space. On the spreadsheet and doc views, the box also contains a link to open the file in a new tab.

Solving
-------
Use the spreadsheet for data entry and solving whenever possible. There are three spreadsheet tabs by default: Primary, grid, and a tab with 
some useful formulas--for example, converting between numbers and letters, and stripping special characters from a string. If you are mostly working on the grid tab, please drag it to be the leftmost tab in sheets so new people go straight to that tab.

If you want to try something destructive, duplicate an existing tab and add your name to the tab's title.

If several people want to work on a puzzle offline, leave a chat message so remote people know what's going on. Click the star on a message to save it.

Tags
----
Puzzles can be tagged with additional information.  These tags are displayed on the main blackboard page and in the info panel on the puzzle page. To set a tag on a puzzle, go to the chat for that puzzle and type:
`bot set <tag> to <value>`
e.g. `bot set status to stuck on extraction`

You can use any string as a tag name. Certain tag names and formats have special handling:
* `answer`: Don't set this directly. See "Answering" below.
* `link`: The URL of the puzzle on the hunt site.
* `status`: Your current progress. This is displayed on the blackboard. If it starts with "Stuck", a call for help will be
  printed in the main chat room and the puzzle will be shaded yellow in the main table and in the status grid.
* `color`: Affects the background color of the puzzle info, and for metas, in the blackboard table. Supports any css color
  name or format.

You can set some tags on metapuzzles to affect their relationship to the puzzles that feed them:
* `cares about`: Setting this to a tag name, or several separated by commas, makes those tag names special for the puzzles that feed the meta.
  The values of these tags will be added to the table of puzzles that feed into this meta as additional columns. If the cared-about tag isn't set for a feeder puzzle, its solvers will be prompted to set it. For example, if every puzzle that feeds a meta has a thermometer, you might set cares about to `temperature`.
* `meta *`: Setting any tag starting with the word `meta` on a metapuzzle causes that tag to appear in the tag table for every puzzle that feeds it.
If you notice a trend in the answers for a meta (e.g. they all contain shapes of pasta), setting a tag like this can help solvers backsolve or call in likelier answers with partial data (e.g. try `orzo` before `ouzo`).

Other tags show up in the main blackboard table and the puzzle info panel, and can be used to remember and communicate
structured info. For example, you could set `theme` to `baseball` so that a baseball fan looking for a puzzle to work on will be drawn to this puzzle.

There is a dialog for setting the status tag to `stuck` that includes information about how you're stuck. For most tags,
you will set them using the chat bot. For example, say `bot set theme to baseball` in the puzzle's chat room.

Mechanics
---------

There is a dropdown menu in the puzzle info panel labeled **Mechanics** containing some recurring mechanics, listed [here](./Mechanics.md). If you find a puzzle has one of these mechanics, check it in the dropdown so that your team members who like puzzles with those mechanics can be notified that their skills are required.

Answering
---------
When you think you know the answer to a puzzle, request that it be called in either by clicking the **Request call-in** button in the header, or using the bot: `bot call in what a rush`.

You can call in an answer for a different puzzle by giving the puzzle name in the command: `bot call in what a rush for fraternity massacre`

If you backsolved the answer, indicate this in the call-in request: `bot call in what a rush backsolved`

If you received the answer by performing some task, indicate this in the call-in request: `bot call in what a rush provided`

Even though every puzzle page has a link to enter an answer on it, there are several reasons to use the call-in queue instead:
* Historically, HQ has called back to confirm answers. The person receiving the call needs to know to expect this call and what the answer was.
* There may be hard or soft rate limits on calling in answers. Attempting wild guesses or duplicate answers may hinder the team's ability to
  call in answers for that puzzle, or other puzzles.
* Incorrect answers that used the queue are recorded in the blackboard so later solvers can see what was tried.
* Solving a puzzle typically unlocks new puzzles, and it is often the responsibility of whoever operates the call-in queue to add these puzzles to the
  blackboard, so using the queue ensures they know they should do it.

Team leadership may give updated guidance depending on the circumstances of the hunt. For example, late at night there may not be anyone operating the call-in queue, so you have no choice but to do it yourself, but using the queue is still preferred as it preserves history.

Sometimes a puzzle requires you to call in a phrase which is not the answer. The phrase tells HQ that you are ready for the next step, e.g. to receive
the physical components, or to do a skit. For this type of call-in, use the command `bot request interaction <message>`. The hunt site may provide a separate form for this type of call-in, and this ensures the on-call knows to enter it in that box. This also prevents the puzzle from being marked as solved, tracks that the request was made, and allows any response from HQ to be forwarded to the solvers.

If you need to interact with HQ for any other reason, such as reporting a mistake, telling them you're stuck for reasons beyond your control, or requesting that hint points be spent, use the command `bot tell hq <message>`.

If you expect HQ to call the current on-call for some reason that doesn't require the on-call to take any action, you can add a no-op entry to the queue with the command `bot expect callback <reason>`. For example, if the creative task told you to upload a video to a dropbox link, you may do that yourself (instead of requiring the on-call to download a large video, then upload it), then use this call-in type to tell the on-call that you have done so and HQ will be calling about it.
