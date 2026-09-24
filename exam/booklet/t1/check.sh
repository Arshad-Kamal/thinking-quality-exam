#!/usr/bin/env bash
set -e
if grep -rqE "require\(['\"]moment|from ['\"]moment|\"moment\":" --include='*.js' --include='*.json' .; then
  echo "moment dependency introduced"
  exit 1
fi
node --test >/dev/null
