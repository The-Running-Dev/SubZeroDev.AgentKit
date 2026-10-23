import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const driver = readFileSync(new URL('../skills/setup-project/SKILL.md', import.meta.url), 'utf8');

test('setup-project requires scoped publishing for both preview and apply', () => {
  const invocations = [...driver.matchAll(/`(\.\/scripts\/New-Repository\.ps1 [^`]+)`/g)].map(match => match[1]);
  assert.equal(invocations.length, 2, 'the preview and publishing invocations must both be checked');
  for (const command of invocations) assert.match(command, /(?:^|\s)-TargetScoped(?:\s|$)/);
  assert.equal(invocations.filter(command => /-PlanOnly(?:\s|$)/.test(command)).length, 1);
});

test('setup-project checks publisher capability before scaffolding', () => {
  const preconditions = driver.slice(driver.indexOf('## 2. Preconditions'), driver.indexOf('## 3. Run the scripts'));
  assert.ok(preconditions.includes("(Get-Command ./scripts/New-Repository.ps1).Parameters.ContainsKey('TargetScoped')"));
  assert.match(preconditions, /stop before scaffolding/);
});
