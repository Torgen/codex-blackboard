#!/bin/bash

scriptroot=$(readlink -f "$(dirname "$0")")

if [ "$(findmnt -T /var/lib/mongodb -n -o fstype)" != "xfs" ]; then
  echo >&2 "MongoDB will complain if /var/lib/mongodb is a file system other than xfs."
  echo >&2 "If you have unallocated disk, consider making a partition now."
  echo >&2 "Stop to do this now, or continue?"
  select stopgo in "Stop" "Continue"; do
    if [ "$stopgo" = "Stop" ]; then
      exit
    elif [ "$stopgo" = "Continue" ]; then
      break
    fi
  done
fi

domainname=$1
while [ -z "$domainname" ]; do
  read -r -p "Need a domain name for the site: " domainname
done

set -e

cd "$HOME"
curl https://install.meteor.com/ | sh

# Set up apt
sudo apt-get install gnupg
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
curl -sL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get update
sudo apt-get install -y mongodb-org nodejs software-properties-common

# This will help us template some files
sudo npm install -g handlebars-cmd
cd "$scriptroot"/../..

# Don't crash if user reruns the install script and we try making the same user
# more than once
sudo useradd -m blackboard || true

# Build the bundle, then install it.
meteor npm install
sudo mkdir /opt/codex
sudo chmod a+rwx /opt/codex
meteor build --directory /opt/codex
cd /opt/codex/bundle/programs/server
sudo npm install

# Copy the static files
sudo cp -a "$scriptroot"/../installfiles/* /
sudo systemctl daemon-reload
node_path=$(npm root -g --no-update-notifier)
staticroom=$(uuidgen)

sudo ln -s /etc/codex-per-hunt-initial.env /etc/codex-per-hunt.env
handlebars <"$scriptroot/../installtemplates/etc/codex-per-team.env.handlebars" --domainname "$domainname" --staticroom "$staticroom" | sudo bash -c "cat > /etc/codex-per-team.env"
handlebars <"$scriptroot/../installtemplates/etc/codex-batch.env.handlebars" --node_path "$node_path" | sudo bash -c "cat > /etc/codex-batch.env"
sudo vim /etc/codex-per-team.env
sudo vim /etc/codex-per-hunt.env
sudo chmod 600 /etc/codex-batch.env
sudo vim /etc/codex-batch.env

# Figure out how many service we're starting.
# On a single core machine, we start a single task at port 28000 that does
# all processing.
# On a multi-core machine, we start a task at port 28000 that only does
# background processing, like the bot. It could handle user requests, but we
# won't direct any at it. We will also start one task per core starting at
# port 28001, and have nginx balance over them.
PORTS=""
if [ "$(nproc)" -eq 1 ]; then
  PORTS="--port batch"
else
  for index in $(seq 1 "$(nproc)"); do
    port=$((index))
    PORTS="$PORTS --port $port"
    sudo systemctl enable "codex@${port}.service"
  done
fi
# ensure transparent hugepages get disabled. Mongodb wants this.
sudo systemctl enable nothp.service
sudo systemctl start mongod.service

# Turn on replication on mongodb.
# This lets the meteor instances act like secondary replicas, which lets them
# get updates in real-time instead of after 10 seconds when they poll.
sudo mongosh --eval 'rs.initiate({_id: "meteor", members: [{_id: 0, host: "127.0.0.1:27017"}]});'

sudo systemctl enable codex-batch.service

sudo snap install --classic certbot

sudo certbot certonly --standalone -d "$domainname"

sudo apt-get install -y nginx

cd /etc/ssl/certs
sudo openssl dhparam -out dhparam.pem 4096
# shellcheck disable=SC2086
handlebars <"$scriptroot/../installtemplates/etc/nginx/sites-available/codex.handlebars" $PORTS --domainname "$domainname" | sudo bash -c "cat > /etc/nginx/sites-available/codex"
sudo ln -s /etc/nginx/sites-{available,enabled}/codex
sudo rm /etc/nginx/sites-enabled/default

sudo systemctl enable codex.target
sudo systemctl start codex.target
sudo systemctl reload nginx.service
