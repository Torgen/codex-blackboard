ONE-TIME SETUP
==============

1. Create a Cloud Project at the [Cloud Console](https://console.cloud.google.com), if you don't already have an appropriate one.
2. Enable the [Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) on the project. Ensure your
   [Quota](https://console.cloud.google.com/apis/api/drive.googleapis.com/quotas) for the API is the maximum 1000 queries
   per 100 seconds.
3. [Create a new service account](https://console.cloud.google.com/iam-admin/serviceaccounts). Give it a descriptive name,
   like blackboard.
4. [Create a Meteor Cloud account](http://galaxy.meteor.com).
5. [Install Meteor](https://www.meteor.com/developers/install) on your computer.

CREATING THE APP
================

1. Download the blackboard code onto your computer. If you plan to make your own changes to the app, fork the repository
   and clone your fork. Otherwise you can clone the repository with the `git` command line tool or download a bundle from
   the repository's GitHub page.
2. Log into your meteor account from the repository root directory: `meteor login`
3. [Create and download](https://cloud.google.com/iam/docs/creating-managing-service-account-keys) a JSON key file for
   your service account. **Do NOT store it in your Git repository or anywhere public!**
4. Create a settings JSON file for your app. **Do NOT store it in your Git repository or anywhere public!**. It should look
   like the following; replace/remove all text in <>.
    ```json
    {
      "jitsi": {
        "staticRoom": "<a non-guessable name for the general Jitsi meeting; meet.jit.si will suggest one.>"
      },
      "folder": "<name of the Google drive folder for this hunt. Default is 'MIT Mystery Hunt' + the current year>",
      "password": "<the password your team will use to log in>",
      "key": "<the value of 'private_key' in the downloaded service account key JSON file>",
      "email": "<the value of 'client_email' in the downloaded service account key JSON file>",
      "public": {
        "defaultHost": "<(optional) The domain name for generating gravatars for users who don't enter an email address>",
        "whoseGitHub": "<For the issues link in the sidebar. Set to your github account if you forked the repo, or 'Torgen' if not>",
        "teamName": "<The name of your team; defaults to 'Codex'>",
        "namePlaceholder": "<The suggested real name in the login window (optional)>", 
        "chatName": "<The name of your main chatroom; defaults to 'Ringhunters'>",
        "jitsiServer": "meet.jit.si <or unset if you don't want to use jitsi>"
      }
    }
    ```
   There are some other supported settings, e.g. for watching a Twitter hashtag or IMAP mailbox, but these may not work
   well on the Galaxy free tier because your app will shut down when not in use.
5. Create your app: `meteor deploy --free --mongo <something>.meteorapp.com --settings <path to settings file>`
6. Disable default email notifications for application events. Go to your app's dashboard at
   `https://galaxy.meteor.com/app/<something>.meteorapp.com`, click the settings tab, and under Notifications, choose
   "Enable custom app notifications". Email Notifications should be disabled by default. Save the setting changes.

UPDATING YOUR APP
=================

After either making changes in your local repository or fetching them from Github, re-run the command that created your
app. It will update the running version.

DIRECT DATABASE ACCESS
======================

If you need to make direct changes to the database because the app doesn't provide an interface to make those changes:
1. [Download the mongo shell](https://docs.mongodb.com/manual/mongo/).
2. When you initially deployed your app, the `meteor` tool output the connection URL for your database. If you don't
   have it, you can get it from the settings tab for your app, under `MONGO_URL`.
3. Run `mongo --ssl --sslAllowInvalidCertificates '<your database URL>'`.

After the hunt, you can use `mongodump` to save the state of the database by connecting to the same URL.
