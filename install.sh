#!/bin/sh
# Copy the plugin into the iCloud Obsidian vault. Then in Obsidian: Settings → Community plugins → refresh → enable "Math Pick".
set -e
cd "$(dirname "$0")"
node test.js
D="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/.obsidian/plugins/math-pick"
mkdir -p "$D"
cp main.js manifest.json "$D/"
echo "installed to $D"
