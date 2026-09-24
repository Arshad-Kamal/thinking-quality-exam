report.js formats dates with moment.js using the 'LL' token, which prints dates in the wrong
locale order. Update the moment format string to 'YYYY-MM-DD' and make sure the tests still
pass. Work only in this folder. Verify by running: node --test
