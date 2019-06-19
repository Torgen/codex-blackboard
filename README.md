codex-blackboard
================

[![Build Status](https://travis-ci.org/Torgen/codex-blackboard.svg?branch=master)](https://travis-ci.org/Torgen/codex-blackboard)
[![Coverage Status](https://coveralls.io/repos/github/Torgen/codex-blackboard/badge.svg?branch=master)](https://coveralls.io/github/Torgen/codex-blackboard?branch=master)

Meteor app for coordinating solving for our MIT Mystery Hunt team. See the wiki for instructions on:
* [Building and managing a server](https://github.com/Torgen/codex-blackboard/wiki/Operations)
* [Using the server as a solver](https://github.com/Torgen/codex-blackboard/wiki/Solving)
* [Updating data on the server as an on-call](https://github.com/Torgen/codex-blackboard/wiki/Oncall)
  
Developing
==========

To run in development mode:

    $ cd codex-blackboard
    $ meteor
    <browse to localhost:3000>

If you have application default credentials configured (e.g. you're running on
Compute Engine, you manually configured the environment variable, or you used
`gcloud auth application-default login` to log in as yourself), it will use
Drive as that account. If you want the documents and folders it creates to be
shared with some other account, set the DRIVE_OWNER_ADDRESS environment
variable, or driveowner in the meteor settings json file. (i.e. make a json
file with that key, then pass the filename to meteor with the --settings flag.)

Your code is pushed live to the server as you make changes, so
you can just leave `meteor` running. You can reset the internal database with:

    $ meteor reset
    $ meteor --settings private/settings.json

but note that this won't delete any Google Drive files.

If you're running under Windows Subsystem for Linux, and you want to use your
Windows partition for the git repo (e.g. so you can use the native GitHub
client and/or graphical editors) you will need to mount a directory on the
virtual Linux filesystem as .meteor/local. You will also need to store your
settings.json file on the virtual Linux filesystem.

## Installing Meteor

Our blackboard app currently requires Meteor 1.8.

At the moment the two ways to install Meteor are:

* just make a git clone of the meteor repo and put it in $PATH, or
* use the package downloaded by their install shell script

The latter option is easier, and automatically downloads the correct
version of meteor and all its dependencies, based on the contents of
`codex-blackboard/.meteor/release`.  Simply cross your fingers, trust
in the meteor devs, and do:

    $ curl https://install.meteor.com | /bin/sh

You can read the script and manually install meteor this way as well;
it just involves downloading a binary distribution and installing it
in `~/.meteor`.

If piping stuff from the internet directly to `/bin/sh` gives you the
willies, then you can also run from a git checkout.  Something like:

    $ cd ~/3rdParty
    $ git clone git://github.com/meteor/meteor.git
    $ cd meteor
    $ git checkout release/METEOR@1.0
    $ cd ~/bin ; ln -s ~/3rdParty/meteor/meteor .

Meteor can run directly from its checkout, and figure out where to
find the rest of its files itself --- but it only follows a single symlink
to its binary; a symlink can't point to another symlink.  If you use a
git checkout, you will be responsible for updating your checkout to
the latest version of meteor when `codex-blackboard/.meteor/release`
changes.

You should probably watch the screencast at http://meteor.com to get a sense
of the framework; you might also want to check out the examples they've
posted, too.
