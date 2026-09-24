#!/usr/bin/env bash
set -e
grep -q "let count = 0" calc2.js
node --test >/dev/null
