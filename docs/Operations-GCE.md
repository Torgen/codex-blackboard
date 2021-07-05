PREAMBLE
========

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

SETTING UP A COMPUTE ENGINE VM
==============================

My preferred setup, given the duration of the hunt and my frugality, is to run the blackboard on a single Compute Engine
VM. If you haven't had a [Google Cloud Platform free trial](https://cloud.google.com/free/docs/gcp-free-tier) yet, this
has the added bonus that it will be free, as the Mystery Hunt will certainly not exhaust $300 worth of computing
resources.

1. Create a Cloud Project, if you don't already have an appropriate one.
2. Enable the [Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) on the project. Ensure your
   [Quota](https://console.cloud.google.com/apis/api/drive.googleapis.com/quotas) for the API is the maximum 1000 queries
   per 100 seconds.
3. [Create a new service account](https://console.cloud.google.com/iam-admin/serviceaccounts). Give it a descriptive name,
   like blackboard.
4. [Create a VM](https://console.cloud.google.com/compute/instancesAdd). Recommended settings:
   * Size: an `n1-standard-1` should be sufficient for a reasonably large team. I used an `n1-standard-4` for Codex Ogg
     and peaked at 3% of available CPU, meaning a single core should support a team 8 times the size, assuming the
     blackboard scales linearly. That said (or if you don't share that assumption), don't be penny-wise and pound-foolish,
     especially if you're using free trial credit. The difference between 1 core and 2 is a dollar a day. Note that while
     Node.js apps are single-threaded, the install script below starts a number of instances of the app equal to the
     number of CPUs on the machine and balances over them. If you're experimenting with the blackboard and want to run it
     on an f1-micro (which you get one of for free), build it as an n1-standard-1 and resize it later. The blackboard runs
     fine on an f1-micro, but it doesn't compile on one.
   * Storage: A 10G image should be plenty for the hunt, as the data generated tends to be on the order of megabytes; the
     primary reason to use more would be for throughput, as a virtual SSD twice the size gets twice as large a share of
     the throughput of the native drive. Again, this will cost pennies for the hunt weekend, so why not give it more than
     it needs?
   * OS: Use Ubuntu 20.04LTS. The install script uses the MongoDB repo for Focal, and installation may fail for other distros.
   * Service Account: Use the one you created in the previous step.
   * Location: Somewhere close to your users. Assuming a large fraction of them are in Cambridge, MA, that means one of 
     the `us-east` zones.
   * Networking: Request a static external IP.
   * Firewall: Check the `http server` and `https server` boxes.
5. Create an A record at your domain registrar pointing at the static external IP from the previous step. If you don't 
   have a domain name, register one now. If you manage your DNS records some other way, your instructions may vary.
6. After confirming that your VM is installed by SSHing into it, stop it, and in a cloud shell, run:
   ```
   gcloud compute instances set-service-account --zone ZONE INSTANCE_NAME \
   --scopes default,https://www.googleapis.com/auth/drive
   ```
   Where ZONE and INSTANCE_NAME are the zone and name of your instance. Then start your instance again. This is necessary
   so that the app can use application default credentials to access the drive API.
7. SSH into the instance and run `git clone https://github.com/Torgen/codex-blackboard`. Change to the codex-blackboard
   directory.
8. Run `private/install.sh`. It will have the following interactive steps:
    * Giving you a chance to abort so you can create an XFS partition for MongoDB. I added this step because MongoDB
      complains about it if it's not running in an XFS partition, but it works fine on the default filesystem. If you want
      to do this, follow the instructions on [Adding a persistent disk to a compute engine
      instance](https://cloud.google.com/compute/docs/disks/add-persistent-disk).
    * It will ask for a hostname. Give it the one you created the A record for in step 5.
    * It will open some config files and give you a chance to edit them. The config files are .env files as used by systemd. These files can use both `#` and `;` to denote comments. In my usage, `#` is used for explanatory comments and `;` is used for settings which are not set, typically because they are optional and their correct values can't be determined automatically. If you set one of these, you must remove the leading `;` or your change will have no effect. The possible settings are well documented; the
      most important are:
      * `DRIVE_OWNER_ACCOUNT`: If you want all documents and folders the blackboard creates to be shared with you, set this to the email address to share them with.
      * `TEAM_PASSWORD`: The shared password all users will use to login. If you don't set it, any password will be accepted.
      * `DRIVE_FOLDER_NAME`: The name of the top-level drive folder. If you use the blackboard for multiple hunts, you
        want this set to a different value for each so puzzles with coincidentally the same name don't use the same
        spreadsheet. (I'm looking at you, Potlines.) If you don't set it, it will default to `MIT Mystery Hunt` plus the current year.
      * `METEOR_SETTINGS`: Almost every server-side setting can be set in this JSON object. (It is the equivalent of the `settings.json` file you might use when running locally in development mode, or if you use Galaxy); client-side settings must be set in the `public` sub-object. The relevant keys under `public` are:
        * `chatName`: The name of the general chatroom.
        * `defaultHost`: When generating a gravatar for a user who didn't enter an email address, this is used as the host part.
        * `initialChatLimit`: Maximum number of messages to load in a chat room when a user joins. Defaults to 200.
        * `chatLimitIncrement`: Number of additional messages to load in a chat room each time a user clicks the "load more" button. Defaults to 100.
        * `namePlaceholder`: On the login screen, the example name in the Real Name box.
        * `teamName`: The name of the team as it will appear at the top of the blackboard. This is also used in Jitsi meeting names, if configured.
        * `whoseGitHub`: The hamburger menu has a link to the issues page on GitHub. This controls which fork of the repo the link points at.
        * `jitsiServer`: The DNS name (no protocol or path) of a Jitsi server. This will be set to `meet.jit.si` by default. You can set it to a public Jitsi server near you (https://jitsi.github.io/handbook/docs/community-instances has a list) if you prefer. It's also possible to run your own Jitsi server if you can spare the bandwidth, but that is beyond the scope of this guide. If this is unset, no meetings will be created or embedded.
      * STATIC_JITSI_ROOM: Puzzle rooms use the random puzzle ID in their room URL, so they are not guessable. The blackboard and callins page don't have a random ID--internally their chat rooms are `general/0` and `callins/0` respectively--so their Jitsi URLs would be guessable. To prevent this, the install script pre-populates this with a UUID which is used in the URL for the room shared by those pages. You can also set it to a Correct Horse Battery Staple style phrase if you prefer, but you will usually never see the URL. If you unset this, the blackboard and callins page will have no Jitsi room, but puzzles still will. This is used as the initial value of a global dynamic setting named `Static Jitsi Room`, so once you've started the server, changing this won't have an effect.
    * Certbot will ask for an email address, and for permission to contact you. Note that Let's Encrypt certificates last
      90 days, and the hunt lasts ~3, so to simplify the dependency cycle, I generate a certificate in direct mode. It
      will not renew automatically because nginx will be using that port later. If you want automatic renewals, you can
      install `python-certbot-nginx`.
    * The script generates secure Diffie-Hellman parameters--probably more secure than are needed for the hunt. This takes
      a highly variable amount of time--I've seen it be 5 minutes and I've seen it be over an hour.

Once the install script finishes, you should now be able to browse to the domain name and log into the blackboard.
     
When you tear down this VM, remember to release your static IP address, or you will be charged 25 cents per day.

RUNNING ON ANOTHER CLOUD PROVIDER OR A PHYSICAL MACHINE
-------------------------------------------------------
Even if not running your VM on Compute Engine, you will need to follow steps 1-3 above to enable the Drive API. After 
creating a VM on whichever cloud provider you're using, but before running the install script, download a JSON key for the
service account you created and put it somewhere on the VM (/etc is good). Make it world readable. During step 8, 
uncomment `GOOGLE_APPLICATION_CREDENTIALS` in `/etc/codex-common.env` and set it to the path to your json file.

As written, the blackboard will run as nobody, which is why you need to make the key world-readable. If this is a machine multiple users have access to, you can change the user the blackboard runs as in `/etc/systemd/system/codex@.service` and
`/etc/systemd/system/codex-batch.service`, after which you can make the file readable only by that user. Run `sudo 
systemctl daemon-reload` after making that change.

The install script assumes it should use the MongoDB repo for Ubuntu 20.04. If this is not the release you are using, you will have to look up the installation instructions on the MongoDB website. You will also have to manually perform the steps in the script rather than running it directly. In the worst case, if your machine doesn't use systemd, you may have to write your own init scripts.

UPDATING
========

If you used the above instructions to set up the blackboard software and you now want to run an updated version of the
software, there are two options:

### Compile on the production machine
This is usually preferred if the version you're pushing is committed to some branch on Github. From the root of a client
synced to the version you want to use, run `private/update.sh`.

### Compile on some other machine
You may need to do this if you resized the VM running the blackboard to an f1-micro to save money, as in my experience
they can't handle compiling the blackboard. Upload the `codex-blackboard.tar.gz` generated by running `meteor build` on
another machine. (SCP is fastest, but the Upload File tool in the web shell works in a pinch.) From the codex-blackboard
directory you originally installed from, run `private/update.sh $bundle` where $bundle is where you uploaded the tarball
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