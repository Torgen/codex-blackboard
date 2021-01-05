Logging In
==========
The login screen contains the following fields:
* **Team Password** (required): You should get this from wherever you got the URL for the blackboard site, 
  whether that was a classroom blackboard/whiteboard, a Slack channel, or a mailing list.
* **Nickname** (required): This can be up to 20 characters.
* **Real Name** (optional): If you don't set this, your nickname will be shown with your chat messages instead.
* **Email Address** (optional): This is used only to look up your [Gravatar](https://en.gravatar.com/). It is 
  never sent to the server or shared with teammates. If you don't have a Gravatar, a geometric "Wavatar" 
  will be generated for you instead.
 
Individual accounts don't have their own passwords. You are trusted not to impersonate one another.
Be careful with the team password. A bad actor can freely create accounts, so there is no way to
ban them short of changing the team password and forcing everyone to log in again.
 
Jitsi Meetings
==============
The main blackboard page and every puzzle page have their own Jitsi meeting.
(Unless the site operator changed the default settings.)
 
When you first log into the blackboard, you join the main Jitsi Meeting. (You may need to grant audio/video permissions).
 
* Changing Meetings (You can only be in one Jitsi Meeting at a time.)
  * Within a browser tab, the Jitsi meeting moves with you. If you open a new page, you move to that meeting.
  * To pin yourself to a specific meeting, click the pin icon within that meeting.
  * To join a specific meeting, click the video icon in the chat line for that page.
  
* Audio/Video settings
  * **By default, you enter meetings with your microphone muted and your camera disabled.**
  * To change your mute/video status within a meeting, click on the mic or video icon in that meeting.
  * To change your default mute/video status, click on the Settings Dropdown at the top of any blackboard page, and toggle the appropriate option.
  
Notifications
=============
You can opt into desktop notifications by clicking the **Enable Notifications Button** at the top of the blackboard. This
will trigger the browser's notification permission dialog. Once you've enabled notifications, you can choose which types
of events you wish to receive notifications for:
* **Announcements**: General messages for everyone. Enabled by default.
* **Answers**: A puzzle was correctly answered. The answer will be included in the message. Clicking this notification will take you to the puzzle page. Enabled by default.
* **Callins**: Someone is requesting an answer be called in for a puzzle. The answer will be included in the message. Clicking this notification will take you to the **Call-Ins** page. Disabled by default.
* **New Puzzles**: A puzzle was unlocked. Clicking this notification will take you to the puzzle page. Disabled by default.
* **Stuck Puzzles**: A puzzle was marked as stuck. Clicking this notification will take you to the puzzle page. Disabled by default.
* **Favorite Mechanics**: A puzzle has been marked as using one of your **Favorite Mechanics**. Clicking this notification will take you to the puzzle page. Enabled by default.
 
Chat 
====
The main chat is shown on almost every page. On the main blackboard page it is in the lower right. On
puzzle pages, the last two lines of the main chat and/or oplog (new rounds/puzzle announcements) are
displayed at the very top of the page.  The chat can be popped out from any of the pages if you want to see more.
 
If you're not sure what you should be doing, this is a good place to ask.

In addition to the main chat, each puzzle page has its own chat.

There are times when you want everyone working on a puzzle to see certain information. 
The easiest way to do this is to send a message and then **Promote the Message** by clicking the **star icon** next to it.  This causes the message to display in the  puzzle info panel. (Or the main blackboard if the message was in the main chat.) e.g.
- All entries are surfers, the colors are their national colors.
- https://www.surfingwiki.com/wiki/Famous_surfers

The bot sometimes generates silly messages, e.g. memes.  These can be hidden via the **Settings Dropdown** option **Hide Bot Tomfoolery**. 

Favorite Puzzles and Mechanics
==============================
A new **Favorite Puzzles Section** displays at the top of your blackboard page if you have any favorite puzzles.
<details>
  <summary>Mark a puzzle as a favorite to find it easily later.</summary>
Every puzzle has a heart icon in both its blackboard grid row and in the info panel on its puzzle page. Clicking the heart adds the puzzle to your personal list of favorites. Clicking it again removes it from your list.
</details>
<details>
  <summary>Mark mechanics as favorites to discover puzzles involving those mechanics.</summary>

Selecting one or more [mechanics](./Mechanics.md) from the **Favorite Mechanics Dropdown** at the top of the blackboard will cause puzzles which are marked as involving any of those mechanics to appear in your favorites. 
 
If you **Enable Notifications**, you will be notified when a puzzle is marked as involving any of those mechanics.
 </details>
You can **Hide Solved Favorites**  via the **Settings Dropdown**.


The Puzzle Page
===============
The default view for every puzzle is five sections:
1) A header containing: a mini-main room chat, breadcrumbs, and general blackboard controls.
2) A pane for the main view, a Google Spreadsheet by default, (Main pane)
3) A pane with information about the puzzle. (Upper Middle Right)
4) A pane with the chat (Lower Middle Right)
5) A pane with the jitsi meeting (Lower right)
 
You can resize the panes (but not the header); your changes will be remembered.

<details>
  <summary>Details about the individual panes</summary>
  
Looking at some of the panes in more detail:
   
The header pane always has a mini-main room chat, breadcrumbs, and general blackboard controls.
There is always a breadcrumb for this puzzle, and for the main blackboard. If this puzzle feeds 
into a metapuzzle, directly, or indirectly, there will be a breadcrumb for the metapuzzle(s) as well.
    
The content of the main pane can be changed by clicking an icon in this puzzles breadcrumb. 
The icons are: puzzle from the hunt website, spreadsheet, doc, puzzle info pane and puzzle chat. 
The pane can be made "full screen", or popped out using the icons in the upper right of the main pane. 
In this case "full screen" means hiding the puzzle page header, thereby giving more solving space.
</details>

The **Mechanics Dropdown** in the puzzle info pane should be used to mark puzzles involving that [mechanic](./Mechanics.md).  e.g. Cryptics.  This will both add the information to the blackboard an notify any 
team members who have favorited this mechanic.

Solving
-------
Use the spreadsheet for data entry and solving whenever possible. There are three spreadsheet tabs by default: Primary, grid, and a tab with
some useful formulas--for example, converting between numbers and letters, and stripping special characters from a string. If you are mostly working on the grid tab, please drag it to be the leftmost tab in sheets so new people go straight to that tab.
 
If you want to try something destructive, duplicate an existing tab and add your name to the tab's title.
 
If several people want to work on a puzzle offline, leave a chat message so remote people know what's going on. Click the star on a message to save it.

If you aren't making any more progress on your current puzzle, the **Flag as STUCK Button** will send a call for help in the main chat room,
and to anyone who has requested to be notified about stuck puzzles. Hopefully someone will arrive soon with fresh ideas.
 
### Tags
Puzzles can be tagged with additional information. These tags are displayed on the main blackboard page
and in the info panel on the puzzle page. Adding tags makes it more likely that the right people look at a
puzzle. They are also useful to convey state to others working on the puzzle. (Especially if you get stuck.)

<details>
  <summary>Details about how to set tags.</summary>
<br>
To set a tag on a puzzle, go to the chat for that puzzle and type:
`bot set <tag> to <value>` e.g. `bot set theme to baseball`. 
You can use any string as a tag name.

To unset a tag, go to the chat for that puzzle and type: `bot unset <tag>`

Certain tag names have special handling:
* `status`: Your current progress. This is displayed on the blackboard. <br>
  If the status starts with "Stuck", a call for help will be printed in the main chat
  room and the puzzle will be shaded yellow in the main table and in the status grid.
  (Using the **Flag as Stuck Button**, right above the puzzle info panel, is often easier and more thorough.)
 
Tags for metapuzzles:
* `color`: Sets the background color for this meta's row in the blackboard table. The rows of all puzzles associated to this meta will be shaded a lighter version of the color. Any css color name or format is accepted. (blue, #beefee)

* `cares about`: Give the name of a concept that every feeder puzzle should provide for this meta. e.g. Temperature.<br>
  Three things will happen when this flag is set. 
  * A chart including this field will appear in the metapuzzles puzzle info page pane.
  * A tag will be added to every feeder puzzle saying Temperure (wanted by SpecificMetaName). 
  * When tag Temperature is set on a feeder puzzle, its value will automatically appear in the meta's chart.  
<br>If the metapuzzle cares about more than one contept, a list can be given. e.g. `bot set cares about to Pressure, Temperature`

* `meta *`: Setting any tag starting with the word `meta` on a metapuzzle causes that tag to appear in the tag table for every puzzle that feeds it. e.g. `set meta answerformat to palindrome of length 9`<br>
 
Please don't use these tags unless you are the team operator:
* `answer`: Don't set this directly. Click the **Request Call-In Button** instead. See "Answering" below for why.
* `link`: The URL of the puzzle on the hunt site. This should be set when the puzzle is created.
</details>

HQ interactions requests (including answers)
--------------------------------------------
When you think you need to interact with HQ, request the interaction by clicking the **Request Call-In Button** in the header of every puzzle, or using the bot.

Prefer using the **Call-in Button** for anything other than a basic answer submission. It is usually, easier, and sertinly less error-prone.  

If a file needs to be uploaded, please upload it yourself, following the instructions from HQ.  Once the file is uploaded, call-in that we should expect a callback from HQ.

<details>
  <summary>Calling in using the bot:</summary>
The Command to call in using the bot:
* This puzzle: `bot call in what a rush`
* Backsolved: `bot call in what a rush backsolved`
* Answer provided by HQ, e.g. after a video submission: `bot call in what a rush provided`
* Non-answer provided by HQ, e.g. you are ready to receive physical components: `bot request interaction the woodchuck chucks charles`
* Reporting a puzzle error, spending hint points, hunt site issues, etc., `bot tell hq <message>`
* HQ will be calling for some other reason (e.g. you uploaded a video for HQ): `bot expect callback <reason>`.

If you are not in that puzzle's chat, you can call in the answer from any chat by specifying the puzzle name:
* Another puzzle: `bot call in what a rush for fraternity massacre backsolved`
</details>
  
<details>
  <summary><strong>Why shouldn't I submit the answer directly on the puzzle hunt site?</strong></summary>
Even though every puzzle page has a link to enter an answer on it, there are several reasons to use the call-in queue instead:
* Historically, HQ has called back to confirm answers. The person receiving the call needs to know to expect this call and what the answer was.
* There may be hard or soft rate limits on calling in answers. Attempting wild guesses or duplicate answers may 
  hinder the team's ability to call in answers for that puzzle, or other puzzles.
* Incorrect answers are recorded in the blackboard so later solvers can see what was tried.

* Solving a puzzle typically unlocks new puzzles.  It is often the responsibility of the call-in queue operator
  to add these puzzles to the blackboard.  Using the queue ensures they know they should do it.

* The hunt site may provide a separate form for event interactions. The team operator will know where to 
  enter the request, an update the blackboard.  Any responses from HQ will be forwarded to the 
  solvers -- usually to the puzzle chat.
</details>

<details>
    <summary><strong>What do I do if no one is around to run the Call-in queue?</strong></summary>
**If no one is around to run the Call-in queue**, e.g. late at night, you have no choice but to submit the 
answer yourself. It is still better to do it through the call-in queue.  It preserves history and has buttons
to update the blackboard for right/wrong answers.  The queue is accessible from the lower left of the main blackboard.  Please don't use it unless you are on duty, or there is no one on duty.
</details>

 
Quips
=====
Quips are funny things to say when we answer phone calls from HQ. We do this because HQ should have fun too.
It also encourages HQ to not delay our callbacks too much if we call in a bunch of wrong answers.
 
Adding quips:
* The easiest way to add a quip is to ask the bot to do it. For example, `bot new quip Codex is my co-dump stat`.
* If you are adding many quips, you can go to \<your hunt site\>/quips/new. E.g. funnyhunters.com/quips/new
 
The list of quips is shown to whomever is manning the call-in queue. Whoever is manning the call-in queue will be given
a selection of not-recently-used quips to choose from.
