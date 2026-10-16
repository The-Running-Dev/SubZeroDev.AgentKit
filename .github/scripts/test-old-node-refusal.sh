#!/usr/bin/env bash
# Run under a Node below the floor: setup.ts must refuse it by name, with exit code 2, before
# it loads any TypeScript. Not a local gate, since it needs that older Node installed.
set -u
output=$(node setup.ts --verify 2>&1)
code=$?
echo "$output"
[ "$code" = 2 ] && grep -q '^AgentKit requires Node >= 22.18; found 22.17' <<< "$output"
