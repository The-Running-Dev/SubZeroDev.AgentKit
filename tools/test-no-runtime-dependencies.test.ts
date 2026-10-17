import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { getRuntimeDependencies } from './test-no-runtime-dependencies.ts';
import { temp, put } from './lib/fixtures.ts';

test('devDependencies alone are not runtime dependencies', () => { const r = temp(); put(r, 'package.json', '{"devDependencies":{"typescript":"^5.9.3"}}'); assert.deepEqual(getRuntimeDependencies(r), []); });
test('every declared dependency is reported by name', () => { const r = temp(); put(r, 'package.json', '{"dependencies":{"yaml":"^2.0.0","chalk":"^5.0.0"}}'); assert.deepEqual(getRuntimeDependencies(r), ['yaml', 'chalk']); });
test('this repository declares none', () => { assert.deepEqual(getRuntimeDependencies(join(import.meta.dirname, '..')), []); });
