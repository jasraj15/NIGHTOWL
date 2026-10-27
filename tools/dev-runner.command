#!/bin/bash
# NightOwl local job runner.
# Double-click this file (or run it) on your Mac. It watches .ci/queue/ for *.sh jobs,
# runs each one from the repo root, and writes stdout/stderr + exit code to .ci/out/.
# It lets a remote assistant run npm scripts (tests, builds, dev servers) on this machine.
# Press Ctrl+C to stop. Nothing outside this repo is touched.
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"
echo "NightOwl runner started in $ROOT"
echo "node: $(node -v 2>&1)  npm: $(npm -v 2>&1)"
echo "Waiting for jobs in .ci/queue/ ... (Ctrl+C to stop)"
mkdir -p .ci/queue .ci/out .ci/running
while true; do
  for job in .ci/queue/*.sh; do
    [ -e "$job" ] || continue
    name="$(basename "$job" .sh)"
    mv "$job" ".ci/running/$name.sh"
    echo "[$(date +%H:%M:%S)] running $name"
    ( cd "$ROOT" && bash ".ci/running/$name.sh" > ".ci/out/$name.log" 2>&1; echo $? > ".ci/out/$name.exit" )
    echo "[$(date +%H:%M:%S)] finished $name (exit $(cat .ci/out/$name.exit))"
    rm -f ".ci/running/$name.sh"
  done
  sleep 1
done
