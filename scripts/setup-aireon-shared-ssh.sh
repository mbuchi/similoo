#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${AIREON_SHARED_DEPLOY_KEY:-}" ]]; then
  echo "AIREON_SHARED_DEPLOY_KEY is required to install @aireon/shared in CI/deploy."
  exit 1
fi

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

key_file="$HOME/.ssh/aireon_shared_deploy_key"
printf '%s\n' "$AIREON_SHARED_DEPLOY_KEY" > "$key_file"
chmod 600 "$key_file"

known_hosts="$HOME/.ssh/known_hosts"
touch "$known_hosts"
chmod 600 "$known_hosts"
ssh-keyscan -t ed25519 github.com >> "$known_hosts" 2>/dev/null

git config --global core.sshCommand "ssh -i $key_file -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$known_hosts"
