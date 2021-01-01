Some of the settings for the blackboard are easy to specify in advance--for example, credentials for external services. Other settings can only be determined once the hunt has started, which is not when you want to restart the blackboard to modify environment variables. These settings can be controlled via the bot. Note that the current, authoritative list of settings, including their default and current values, can be enumerated by entering `/msg bot global list` in any chat room. You can set any setting by saying `bot global set SETTING NAME to VALUE` in any chat room. The bot will tell you if your value is illegal for the setting you chose.

# Round Url Prefix

Hunt sites tend to have common patterns for the URLs for the various rounds. The blackboard can attempt to derive the URL for a round based on its name and the common name normalization algorithm it uses throughout. Set this to the path to the directory that contains the rounds to enable this. Don't set this if there's no single directory that contains all the rounds.

Format: empty string, or a URL with the http or https protocol.

# Puzzle Url Prefix

Hunt sites also tend to have common patterns for the URLs for the various puzzles. The blackboard can attempt to derive the URL for a puzzle based on its name and the common name normalization algorithm it uses throughout. Set this to the path to the directory that contains the puzzles to enable this. Don't set this if there's no single directory that contains all the puzzles, e.g. because they're grouped by the round they're in. In this case the oncall will have to set the URL for each puzzle individually. Also remember that this isn't foolproof; for example, in 2019 the Problems (i.e. metapuzzles) had a different URL prefix than the leaf puzzles.

Format: empty string, or a URL with the http or https protocol.

# Embed Puzzles

It is possible to set the X-Frame-Options header on an HTTP response to tell browsers not to render that page in an iframe. MIT hunt sites tend not to use this, but other hunts like Caltech have. If the hunt you're solving does set this header, the puzzle tab on the puzzle page, which shows the puzzle alongside the chat, will be useless and generate errors. Set this to false to hide it.

Format: boolean

# Maximum Meme Length

Unless it was disabled with an environment variable, there is a Hubot module that generates memes for common patterns. This setting controls the maximum length of the regular expression match that can generate a meme. You might increase it before the hunt starts while people are playing around and decrease it to a reasonable limit to avoid annoying people with long memes that match a tiny subset of a long message later.

Format: integer

# Static Jitsi Room

If a Jitsi server is enabled, this is appended to the team name to make the room used for the blackboard and callins pages. If you set it to the empty string, those pages won't have a room. It is not expected that you will often want to change this during the hunt, but unlike a public setting it's only visible after login.

Format: string; a single URL path component.