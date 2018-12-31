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

My preferred setup, given the duration of the hunt and my frugality, is to run the blackboard on a single Compute Engine VM.
If you haven't had a [Google Cloud Platform free trial](https://cloud.google.com/free/docs/gcp-free-tier) yet, this has the
added bonus that it will be free, as the Mystery Hunt will certainly not exhaust $300 worth of computing resources.

1. Create a Cloud Project, if you don't already have an appropriate one.
2. Enable the [Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) on the project.
3. [Create a new service account](https://console.cloud.google.com/iam-admin/serviceaccounts). Give it a descriptive name,
   like blackboard.
4. [Create a VM](https://console.cloud.google.com/compute/instancesAdd). Recommended settings:
  * Size: an `n1-standard-1` should be sufficient for a reasonably large team. I used an `n1-standard-4` for Codex Ogg
    and peaked at 3% of available CPU, meaning a single core should support a team 8 times the size, assuming the blackboard
    scales linearly. That said (or if you don't share that assumption), don't be penny-wise and pound-foolish, especially if
    you're using free trial credit. The difference between 1 core and 2 is a dollar a day. Note that while Node.js apps are
    single-threaded, my install script below starts a number of instances of the app equal to the number of CPUs on the
    machine and balances over them. If you're experimenting with the blackboard and want to run it on an f1-micro (which you
    get one of for free), build it as an n1-standard-1 and resize it later. The blackboard runs fine on an f1-micro, but it
    doesn't compile on one.
  * Storage: A 10G image should be plenty for the hunt, as the data generated tends to be on the order of megabytes; the
    primary reason to use more would be for throughput, as a virtual SSD twice the size gets twice as large a share of the
    throughput of the native drive. Again, this will cost pennies for the hunt weekend, so why not give it more than it needs?
  * OS: I use the latest LTS release of Ubuntu, which is currently 18.04. You can use some other Linux distro if you want,
    but know that I haven't tested with it. Use a release recent enough that it uses systemd.
  * Service Account: Use the one you created in the previous step.
  * Location: Somewhere close to your users. Assuming a large fraction of them are in Cambridge, MA. that means one of the
    `us-east` zones.
  * Networking: Request a static external IP.
  * Firewall: Check the `http server` and `https server` boxes.
5. Create an A record at your domain registrar pointing at the static external IP from the previous step. If you don't have a
   domain name, register one now. If you manage your DNS records some other way, your instructions may vary.
6. After confirming that your VM is installed by SSHing into it, stop it, and in a cloud shell, run:
```
gcloud compute instances set-service-account --zone ZONE INSTANCE_NAME \
--scopes default,https://www.googleapis.com/auth/drive
```
   Where ZONE and INSTANCE_NAME are the zone and name of your instance. Then start your instance again. This is necessary so
   that the app can use application default credentials to access the drive API.
7. SSH into the instance and run `git clone https://github.com/Torgen/codex-blackboard`. Change to the codex-blackboard
   directory. If you want to use the Multi-Meta version of the blackboard and
   [this pull request](https://github.com/Torgen/codex-blackboard/pull/74) hasn't been merged yet, run
   `git checkout -b multimeta`. Note that regardless of which features you want in your version of the blackboard,
   [the upstream repo](http://github.com/cjb/codex-blackboard) doesn't support application default credentials yet.
 8. Run `private/install.sh`. It will have the following interactive steps:
   * Giving you a chance to abort so you can create an XFS partition for MongoDB. I added this step because MongoDB complains
     about it if it's not running in an XFS partition, but it works fine on the default filesystem.
   * It will ask for a hostname. Give it the one you created the A record for in step 5.
   * It will open some config files and give you a chance to edit them. The possible settings are well documented; the most
     important are:
     * `DRIVE_OWNER_NAME` and `DRIVE_OWNER_ACCOUNT`: The blackboard always shares its created drive folders with a human
       account. Set these to the display name and email address of that account respectively. If you don't set these, it will
       share your files with me, which you may not want.
     * `TEAM_PASSWORD`: The shared password all users will use to login. If you don't set it, the password will be empty.
     * `DRIVE_FOLDER_NAME`: The name of the top-level drive folder. If you use the blackboard for multiple hunts, you want
       this set to a different value for each so puzzles with coincidentaly the same name don't use the same spreadsheet.
       (I'm looking at you, Potlines.)
   * Certbot will ask for an email address, and for permission to contact you. Note that Let's Encrypt certificates last
     90 days, and the hunt lasts ~3, so to simplify the dependency cycle, I generate a certificate in direct mode. It will not
     renew automatically because nginx will be using that port later. If you want automatic renewals, you can install
     `python-certbot-nginx`.
   * The script generates secure Diffie-Hellman parameters--probably more secure than are needed for the hunt. This takes a
     highly variable amount of time--I've seen it be 5 minutes and I've seen it be over an hour.

Once the install script finishes, you should now be able to browse to the domain name and log into the blackboard.
     
When you tear down this VM, remember to release your static IP address, or you will be charged 25 cents per day.
