#!/bin/bash

scriptroot=$(basename $0)

if [ "$(findmnt -T /var/lib/mongodb -n -o fstype)" != "xfs" ] ; then
  echo >&2 "MongoDB will complain if /var/lib/mongodb is a file system other than xfs."
  echo >&2 "If you have unallocated disk, consider making a partition now."
  echo >&2 "Stop to do this now, or continue?"
  select stopgo in "Stop" "Continue"; do
    if [ "$stopgo" = "Stop" ]; then return; fi
  done
fi

domainname=$1
while [ -z "$domainname" ] ; do
  read -p "Need a domain name for the site" domainname
done

set -e

cd $HOME
curl https://install.meteor.com/ | sh

function sudopart() {

  # Set up apt
  apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 0C49F3730359A14518585931BC711F9BA15703C6
  echo "deb [ arch=amd64,arm64 ] http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.4 multiverse" > /etc/apt/sources.list.d/mongodb-org-3.4.list
  curl -sL https://deb.nodesource.com/setup_8.x | bash -
  apt-get install -y mongodb-org nginx nodejs

  # This will help us template some files
  npm install -g handlebars-cmd
  cd $scriptroot/..

  # Build the bundle, then install it.
  meteor npm install --save babel-runtime
  meteor build ../build
  mkdir /opt/codex
  tar -C /opt/codex -xz < ../build/codex-blackboard.tar.gz
  cd /opt/codex/bundle/programs/server
  npm install

  # Copy the static files
  cp -a $scriptroot/installfiles/* /

  handlebars < $scriptroot/installtemplates/etc/codex-common.env.handlebars > /etc/codex-common.env --domainname "$domainname"
  $EDITOR /etc/codex-common.env
  chmod 600 /etc/codex-batch.env
  $EDITOR /etc/codex-batch.env

  # Figure out how many service we're starting.
  # On a single core machine, we start a single task at port 28000 that does
  # all processing.
  # On a multi-core machine, we start a task at port 28000 that only does
  # background processing, like the bot. It could handle user requests, but we
  # won't direct any at it. We will also start one task per core starting at
  # port 28001, and have nginx balance over them.
  PORTS=""
  if [ $(nproc) -eq 1 ]; then
    PORTS="--port 28000"
  else
    for index in {1..$(nproc)}; do
      port=$[$index + 28000]
      PORTS="$PORTS --port $port"
      systemctl enable codex@${port}.service
    done
  fi
  # ensure transparent hugepages get disabled. Mongodb wants this.
  systemctl enable nothp.service
  systemctl start mongod.service
  
  # Turn on replication on mongodb.
  # This lets the meteor instances act like secondary replicas, which lets them
  # get updates in real-time instead of after 10 seconds when they poll.
  mongo --eval 'rs.initiate({_id: "meteor", members: [{_id: 0, host: "127.0.0.1:27017"}]});'

  systemctl enable codex-batch.service
  handlebars < $scriptroot/installtemplates/etc/nginx/sites-available/codex.handlebars > /etc/nginx/sites-available $PORTS --domainname "$domainname"
  ln -s /etc/nginx/sites-{available,enabled}/codex
  
  systemctl enable codex.target
  systemctl start codex.target
  systemctl reload nginx.service
}

sudo sudopart
  





