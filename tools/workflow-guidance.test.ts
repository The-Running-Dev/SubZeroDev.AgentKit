import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getSkill } from './get-agentkit-skill.ts';
import { skillPrompt } from './invoke-codex-command.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const shared = readFileSync(new URL('../AGENTS.shared.md', import.meta.url), 'utf8');

test('shared requires observed Git state and correction of unsupported claims', () => {
  assert.match(shared, /Git state.*branch.*detached.*clean.*commits/);
  assert.match(shared, /tool output or explicitly supplied evidence/);
  assert.match(shared, /missing Git metadata.*unknown/);
  assert.match(shared, /withdraw.*unsupported claim/i);
});

for (const command of ['next', 'fix']) {
  test(`${command} delivers the prose-only shortcut through the canonical reader and prompt wrapper`, () => {
    // Real canonical body, not an injected fixture that could bypass the runtime reader.
    const body = getSkill(command, { root, env: { AGENTKIT_AUTO_UPDATE: 'off' } });
    const prompt = skillPrompt(command, ['Assess an introductory spelling correction.'], body);
    for (const text of [body, prompt]) {
      assert.match(text, /prose-only edit/i);
      assert.match(text, /few lines.*Criteria.*Verified/);
      assert.match(text, /Do not inventory unrelated/);
      assert.match(text, /not a reason to invent.*tracking|do not invent.*tracking/i);
      assert.match(text, /not run/);
    }
  });
}
