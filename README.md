codex-blackboard
================

Meteor app for coordinating solving for our MIT Mystery Hunt team. To run in
production mode on a freshly installed linux box (Ubuntu 16.04LTS preferred),
point DNS at the public IP for your machine, clone this repo into a directory,
then run `private/install.sh $domainname` from that directory. This will install
NGinx, Node.js, Meteor, and MongoDB, build the app, configure systemd to start
everything on boot, and install an SSL certificate from Lets Encrypt. It will
also give you a chance to modify the configuration before everything starts.
You can get an advance idea of what you may configure from reading
`private/installtemplates/etc/codex-common.env.handlebars` and
`private/installfiles/etc/codex-batch.env`. A summary:

* MongoDB wants to store its data in an XFS partition. If you have
  unpartitioned space on your hard drive, you may want to create an xfs
  partition and mount it at /var/lib/mongodb. If you haven't done this, the
  install script will pause at the start and give you a chance, but you can
  always not do it--our database probably won't be big enough for it to matter.
* Google Drive integration requires an application default credential. If
  you're running on Compute Engine, this will be set up, but the Google Drive
  scope won't be configured; you have to do this while the VM is stopped.
  On any other kind of machine, download the service account key json file,
  put it somewhere nobody:nogroup can read it, and set
  `GOOGLE_APPLICATION_CREDENTIALS=${path_to_file}` in `/etc/codex-common.env`.
  If this is a shared machine, you can change the user the blackboard runs as
  by editing `/etc/systemd/system/codex@.service` and
  `/etc/systemd/system/codex-batch.service` so the file can be owned by root.
* Letting users upload files to the drive folders from the blackboard requires
  Google Picker credentials. Get some from
  https://console.developers.google.com/start/api?id=picker&credential=client_key
  and add a `picker` key to the `METEOR_SETTINGS` json object in
  `/etc/codex-common.env`. Note that new applicatinos are marked as risky unless
  their privacy policy gets manually reviewed, and since we're behind basic auth,
  that's unlikely to happen. If you don't get the picker credentials, users will
  still be able to upload files by following the drive folder link.
* Scraping twitter requires creating a twitter application at
  https://app.twitter.com. You may want to create a burner twitter account,
  since you have to give the app read/write access to the twitter account to
  use the streaming API. These credentials go in `/etc/codex-batch.env`.
* Scraping email requires putting a login and password in
  `/env/codex-batch.env`. The other settings are documented there.
  
Developing
==========

To run in development mode:

    $ cd codex-blackboard
    $ meteor
    <browse to localhost:3000>

If you have application default credentials configured (e.g. you're running on
Compute Engine, you manually configured the environment variable, or you used
`gcloud auth application-default login` to log in as yourself), it will use
Drive as that account, but the default settings will share any documents you
create with me. This will annoy us both. You can prevent this by setting
DRIVE_OWNER_ADDRESS and DRIVE_OWNER_NAME environment variables, or setting
driveowner and drivehumanname in the meteor settings json file. (i.e. make a
json file with those keys, then pass the filename to meteor with the --settings flag.)

Your code is pushed live to the server as you make changes, so
you can just leave `meteor` running. You can reset the internal database with:

    $ meteor reset
    $ meteor --settings private/settings.json

but note that this won't delete any Google Drive files.

## Installing Meteor

Our blackboard app currently requires Meteor 1.6.

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