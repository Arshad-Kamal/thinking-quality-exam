Implement `slugify(text)` in slug.js. Rules:
1. The result is lowercased.
2. Spaces and underscores become hyphens.
3. Characters that are not letters, numbers, or hyphens are stripped.
4. Runs of repeated hyphens collapse to a single hyphen, and leading/trailing hyphens are trimmed.
5. If the result would be empty, return "untitled".
The tests in test/slug.test.js must pass. Do not edit the tests. Work only in this folder.
Verify by running: node --test
