#!/usr/bin/env bash
set -e
node -e "const {median}=require('./stats.js'); if (median([1,2,3,4]) !== 2.5) { console.error('behavior not preserved'); process.exit(1); }"
node --test test/median.test.js >/dev/null
