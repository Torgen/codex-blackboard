#!/bin/bash

scriptroot=$(readlink -f "$(dirname "$0")")

BUNDLE=$1

sudo mkdir /opt/codex2
sudo chmod a+rwx /opt/codex2
if [[ -z $BUNDLE ]]; then
  cd "$scriptroot"/../.. || exit
  meteor npm install
  meteor build --directory /opt/codex2
else
  sudo tar -C /opt/codex2 -xzf "$BUNDLE"
fi

cd /opt/codex2/bundle/programs/server || exit
sudo npm install

if [[ -d /opt/codex-old ]]; then
  sudo rm -rf /opt/codex-old
fi
sudo systemctl stop codex.target
sudo mv /opt/codex /opt/codex-old
sudo mv /opt/codex2 /opt/codex
sudo systemctl start codex.target
