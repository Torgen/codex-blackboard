# Operations

## PREAMBLE

There are two "right" ways to deploy a Meteor app in production:

1. Use `meteor deploy` to run it on Galaxy, Meteor's Appengine-like wrapper around AWS EC2 instances.
2. Use `meteor build` to generate a tarball containing the compiled app, then deploy it as you might any Node.js app.

While Galaxy has some nice features for long-running apps, such as Websockets-aware load balancing and SSL termination,
it's expensive compared to raw VMs and the DevOps features matter more for an app that will be used for months, not days.
As such, option 2 is preferable for us. Note that there's no option 3 involving `meteor run`. This is development mode,
even if you minify the code using the `--production` flag.

Both options 1 and 2 require that you provide a MongoDB instance with replication enabled. For either option this can be
MongoDB Atlas, which provides a free tier that should suffice for the data size involved in the hunt; for option 2, if
you're running the app on a single VM, this can instead be a locally-running instance. The instructions below set up the
latter.

## Changes for 2025

If you set up a server or VM for a previous year's version of Blackboard and intended to update Blackboard only, be aware
that the 2024 and earlier versions of Blackboard used Meteor 2, which used Node 14 because it depended on the Fibers
library to provide thread-like behavior. An undocumented API in the V8 runtime that enabled Fibers to work was changed in
Node 16, which required the Meteor team to completely rewrite the parallelism on the server-side to use Promises. This was
completed in Meteor 3, which Blackboard now uses; as such:

- You will need to update Node to version 20
- You will not be able to switch back to an older version of Blackboard
- There may be other changed to dependencies which mean it will no longer run on an older OS (e.g. Ubuntu 20.04).

If you're using a VM, you may be better off creating a new one rather than using your existing one.

## SETTING UP A COMPUTE ENGINE VM

My preferred setup, given the duration of the hunt and my frugality, is to run the blackboard on a single Compute Engine
VM. If you haven't had a [Google Cloud Platform free trial](https://cloud.google.com/free/docs/gcp-free-tier) yet, this
has the added bonus that it will be free, as the Mystery Hunt will certainly not exhaust $300 worth of computing
resources.

1. Create a Cloud Project, if you don't already have an appropriate one.
2. Enable the [Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) on the project. Ensure your
   [Quota](https://console.cloud.google.com/apis/api/drive.googleapis.com/quotas) for the API is the maximum 1000 queries
   per 100 seconds.
3. (_New for 2022_) Enable the [Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)
   on the project.
4. [Create a new service account](https://console.cloud.google.com/iam-admin/serviceaccounts). Give it a descriptive name,
   like blackboard.
5. (_New for 2023_) If members of your team will be solving in a common location with a projector or large screen and you
   want to use the projector features, [Create a Google Maps JavaScript API key](https://console.cloud.google.com/project/_/google/maps-apis/credentials).
   Restrict its use to the domain name you will host your site on.
6. [Create a VM](https://console.cloud.google.com/compute/instancesAdd). Recommended settings:
   - Size: an `e2-standard-2` should be sufficient for a reasonably large team. That said, don't be penny-wise and
     pound-foolish, especially if you're using free trial credit. The difference between 1 core and 2 is a dollar a day.
     Note that while Node.js apps are single-threaded, the install script below starts a number of instances of the app
     equal to the number of CPUs on the machine and balances over them. If you're experimenting with the blackboard and
     want to run it on an e2-micro (which you get one of for free), build it as an e2-standard-2 and resize it later.
     The blackboard runs fine on an e2-micro, but it doesn't compile on one.
   - Storage: A 10G image should be plenty for the hunt, as the data generated tends to be on the order of megabytes; the
     primary reason to use more would be for throughput, as a virtual SSD twice the size gets twice as large a share of
     the throughput of the native drive. Again, this will cost pennies for the hunt weekend, so why not give it more than
     it needs?
   - OS: Use Ubuntu 24.04LTS. The install script uses the MongoDB repository for Noble, and installation may fail for
     other distros.
   - Service Account: Use the one you created in the previous step.
   - Location: Somewhere close to your users. Assuming a large fraction of them are in Cambridge, MA, that means one of
     the `us-east` zones.
   - Networking: Request a static external IP.
   - Firewall: Check the `http server` and `https server` boxes.
7. Create an A record at your domain registrar pointing at the static external IP from the previous step. If you don't
   have a domain name, register one now. If you manage your DNS records some other way, your instructions may vary.
8. (_Updated for 2022_) After confirming that your VM is installed by SSHing into it, stop it, and in a cloud shell, run:
   ```sh
   gcloud compute instances set-service-account --zone ZONE INSTANCE_NAME \
   --scopes default,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/calendar
   ```
   Where ZONE and INSTANCE_NAME are the zone and name of your instance. Then start your instance again. This is necessary
   so that the app can use application default credentials to access the drive API.
9. SSH into the instance and run `git clone https://github.com/Torgen/codex-blackboard`. Change to the codex-blackboard
   directory.
10. Run `ops/scripts/install.sh`. It will have the following interactive steps:
    - Giving you a chance to abort so you can create an XFS partition for MongoDB. I added this step because MongoDB
      complains about it if it's not running in an XFS partition, but it works fine on the default filesystem. If you want
      to do this, follow the instructions on [Adding a persistent disk to a compute engine
      instance](https://cloud.google.com/compute/docs/disks/add-persistent-disk).
    - It will ask for a hostname. Give it the one you created the A record for in step 5.
    - It will open some config files and give you a chance to edit them. The config files are .env files as used by systemd.
      These files can use both `#` and `;` to denote comments. In my usage, `#` is used for explanatory comments and `;`
      is used for settings which are not set, typically because they are optional and their correct values can't be determined automatically.
      If you set one of these, you must remove the leading `;` or your change will have no effect. The possible settings are well documented;
      the most important are:
      - `SHARED_DRIVE`: Necessary if running as a service account created after 15 April 2025, as
        it will not have its own Drive quota and will be unable to create files. Shared drives can only be created by accounts that belong to Google Workspace domains, but they can be shared with anyone. If you use this, give the service account the machine runs as the `organizer` permission on the shared drive.
      - `DRIVE_OWNER_ADDRESS`: If you want all documents, folders, and calendars the blackboard creates to be shared with you, set this to the email address to share them with.
      - `DRIVE_SHARE_GROUP`: (_New for 2022_) If you have a Google group for members of your team, either at
        `googlegroups.com` or a workspace domain, setting this will share the documents and folders with them so that they can appear in the UI as themselves instead of as anonymous animals. It will also let them edit the calendar. (Unlike drive, calendars can't be made writable to anyone with the link.)
      - `TEAM_PASSWORD`: The shared password all users will use to login. If you don't set it, any password will be accepted.
      - `DRIVE_FOLDER_NAME`: The name of the top-level drive folder. If you use the blackboard for multiple hunts, you want this set to a different value for each so puzzles with coincidentally the same name don't use the same spreadsheet. (I'm looking at you, Potlines.) If you don't set it, it will default to `MIT Mystery Hunt` plus the current year.
      - `METEOR_SETTINGS`: Almost every server-side setting can be set in this JSON object. (It is the equivalent of the `settings.json`
        file you might use when running locally in development mode, or if you use Galaxy); client-side settings must be set in the
        `public` sub-object. The relevant keys under `public` are:
        - `chatName`: The name of the general chatroom.
        - `defaultHost`: When generating a gravatar for a user who didn't enter an email address, this is used as the host part.
        - `initialChatLimit`: Maximum number of messages to load in a chat room when a user joins. Defaults to 200.
        - `chatLimitIncrement`: Number of additional messages to load in a chat room each time a user clicks the "load more" button. Defaults to 100.
        - `mapsApiKey`: (_New for 2023_) If you created a maps API key above, set it here to enable to solver map.
        - `namePlaceholder`: On the login screen, the example name in the Real Name box.
        - `teamName`: The name of the team as it will appear at the top of the blackboard. This is also used in Jitsi meeting names, if configured.
        - `whoseGitHub`: The hamburger menu has a link to the issues page on GitHub. This controls which fork of the repository the link points at.
        - `jitsiServer`: The DNS name (no protocol or path) of a Jitsi server. This is no longer set by default, because the server at `meet.jit.si` is no longer free.
          You can set it to a public Jitsi server near you (<https://jitsi.github.io/handbook/docs/community-instances> has a list), but some servers on that list aren't actually open to the public.
          It's also possible to run your own Jitsi server if you can spare the bandwidth. See below for instructions.
          If this is unset, no meetings will be created or embedded.
      - `STATIC_JITSI_ROOM`: Puzzle rooms use the random puzzle ID in their room URL, so they are not guessable.
        The blackboard and callins page don't have a random ID--internally they use the `general/0` chat room--so their Jitsi URLs would be guessable.
        To prevent this, the install script pre-populates this with a UUID which is used in the URL for the room shared by those pages.
        You can also set it to a "Correct Horse Battery Staple"-style phrase if you prefer, but you will usually never see the URL.
        If you unset this, the blackboard and callins page will have no Jitsi room, but puzzles still will.
        This is used as the initial value of a global dynamic setting named `Static Jitsi Room`, so once you've started the server, changing this won't have an effect.
      - `JITSI_APP_NAME`: If you're running a private Jitsi server and you want to use JWT authentication based on a shared secret, set this to the app name you gave
        when installing `jitsi-meet-tokens`. Otherwise don't set it.
      - `JITSI_SHARED_SECRET`: If you're running a private Jitsi server and you want to use JWT authentication based on a shared secret, set this to the shared secret you gave
        when installing `jitsi-meet-tokens`. Otherwise don't set it. This doesn't need to be the same as the server password, and users don't need to know this to connect toJitsi.
    - Certbot will ask for an email address, and for permission to contact you. Note that Let's Encrypt certificates last
      90 days, and the hunt lasts ~3, so to simplify the dependency cycle, I generate a certificate in direct mode. It
      will not renew automatically because nginx will be using that port later. If you want automatic renewals, you can
      install `python-certbot-nginx`.
    - The script generates secure Diffie-Hellman parameters--probably more secure than are needed for the hunt. This takes
      a highly variable amount of time--I've seen it be 5 minutes and I've seen it be over an hour.

Once the install script finishes, you should now be able to browse to the domain name and log into the blackboard.

When you tear down this VM, remember to release your static IP address, or you will be charged 25 cents per day.

### RUNNING ON ANOTHER CLOUD PROVIDER OR A PHYSICAL MACHINE

Even if not running your VM on Compute Engine, you will need to follow steps 1-3 above to enable the Drive API. After
creating a VM on whichever cloud provider you're using, but before running the install script, download a JSON key for the
service account you created and put it somewhere on the VM (/etc is good). Make it readable by the `blackboard` user and/or group.
During step 8, uncomment `GOOGLE_APPLICATION_CREDENTIALS` in `/etc/codex-common.env` and set it to the path to your json file.

As written, the script will create a dedicated user and group both named `blackboard` which the app will run as.
If you installed the app for the 2025 MIT Mystery Hunt, the Systemd units that were installed at that time ran
the app as nobody/nogroup. If you need the app to run as a dedicated user because you want to give it access to files
that shouldn't be public, you can update the `User` and `Group` entries in the `[Service]` section of the unit files;
make sure to run `sudo systemctl daemon-reload` afterwards.

The install script assumes it should use the MongoDB repository for Ubuntu 20.04. If this is not the release you are using,
you will have to look up the installation instructions on the MongoDB site.
You will also have to manually perform the steps in the script rather than running it directly.
In the worst case, if your machine doesn't use systemd, you may have to write your own init scripts.

## UPDATING

If you used the above instructions to set up the blackboard software and you now want to run an updated version of the
software, there are two options:

### Compile on the production machine

This is usually preferred if the version you're pushing is committed to some branch on GitHub. From the root of a client
synced to the version you want to use, run `ops/scripts/update.sh`.

### Compile on some other machine

You may need to do this if you resized the VM running the blackboard to an f1-micro to save money, as in my experience
they can't handle compiling the blackboard. Upload the `codex-blackboard.tar.gz` generated by running `meteor build` on
another machine. (SCP is fastest, but the Upload File tool in the web shell works in a pinch.) From the codex-blackboard
directory you originally installed from, run `ops/scripts/update.sh $bundle` where $bundle is where you uploaded the tarball
to.

### Rolling Back

Either way of updating puts the new version in `/opt/codex` and the old version in `/opt/codex-old`. If the new version
has some fatal bug and you need to roll back to the old version, do the following:

```sh
sudo systemctl stop codex.target
sudo mv /opt/codex /opt/codex-bad
sudo mv /opt/codex-old /opt/codex
sudo systemctl start codex.target
```

### Modifying settings

The install script divides the settings among three .env files in the `/etc` directory:

- `codex-per-team.env`: Settings that probably won't change even if you use the same server for multiple hunts.
- `codex-per-hunt.env`: A symlink to another file in the same directory. These settings are likely to change if
  you use the server for another hunt. To do this, duplicate the current file with a name that reflects the new
  hunt, modify the appropriate settings, then move the symlink to point to the new file with
  `ln -s -f $NEWFILE /etc/codex-per-hunt.env`. The settings you'll likely want to edit are:
  - `MONGO_URL`: Only the portion after the slash needs to be changed.
  - `DRIVE_SHARE_GROUP`: If you have a different mailing list for participants in the new hunt than the old one.
  - `DRIVE_ROOT_FOLDER`: Especially if you change `DRIVE_SHARE_GROUP`, or else your team for the previous hunt
    will have access to the files for the new one.
- `codex-batch.env`: Settings specific to batch operations, such as the Hubot instance. If your machine has 2 or
  CPUs or vCPUS, the setup script will run N+1 instances of the app: N which nginx balances across, and 1 just
  for the batch operations so they can always run in parallel with user load. In that case, the batch instance
  will have these settings and the user-facing instance won't. If you only have 1 CPU or vCPU, it will only run
  one instance of the app, which will do everything.

After editing settings, run `sudo systemctl restart codex.target`.

## Setting up a private Jitsi Server

If you want to set up your own Jitsi server to avoid depending on the largesse of a public server operator:

1. Set up a machine/VM. If using Google Cloud:

   - I used the Ubuntu 22.04LTS image.
   - I have no idea how large a machine is necessary for any given team size.
   - You will need to set up firewall rules that allow access to TCP port 5349 and UDP ports 3478 and 10000. Associate it with a firewall tag and give your new VM the tag.
     Follow the [setup instructions based on the distribution you chose](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-quickstart/),
     including setting up DNS records.

2. (Optional) Install `jitsi-meet-tokens` on your new machine. If you don't do this, your server will be open to the world, and anyone will be able to use your bandwidth.

3. If your blackboard machine is already set up, make the following changes to `/etc/codex-per-team.env`:
   - In the JSON object which is the value of `METEOR_SETTINGS`, set `jitsiServer` to the DNS name of your jitsi server.
   - (if you followed step 2) Set `JITSI_APP_NAME` and `JITSI_SHARED_SECRET` to the app name and shared secret you entered when you installed `jitsi-meet-tokens`.
