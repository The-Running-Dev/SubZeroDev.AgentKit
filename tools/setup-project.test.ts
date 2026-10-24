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

const section = (start: string, end: string) => driver.slice(driver.indexOf(start), driver.indexOf(end));

test('setup-project requires the name but not the language', () => {
  assert.match(driver, /^argument-hint: "<Name> \[language\] \[options\]"$/m);
  assert.doesNotMatch(driver, /If the name or the language is missing, ask/);
  assert.match(driver, /The name is required; if it is missing, ask\. The language is optional\./);
});

test('setup-project keeps a deferred language deferred', () => {
  assert.match(driver, /the language is \*\*deferred\*\*: accept that, do not ask again, and never choose, suggest or default one/);
  assert.match(section('## 3. Run the scripts', '## 4. Commit the definition'), /With the language deferred, leave out `-Language` entirely/);
});

test('setup-project passes a given language as before', () => {
  const scaffolds = [...driver.matchAll(/`(\.\/scripts\/New-Project\.ps1 [^`]+)`/g)].map(match => match[1]);
  assert.deepEqual(scaffolds, ['./scripts/New-Project.ps1 -Name <Name> -Language <language> <options> -LocalOnly']);
});

test('setup-project finds the canonical checkout outside sibling folders, and never clones it', () => {
  const locate = section('## 1. Locate the checkout', '## 2. Preconditions');
  const candidates = ['$env:SUBZERODEV_GITHUB_HOME', 'sibling of the current repository', 'D:\\Dropbox\\Projects\\SubZeroDev.GitHub'];
  const positions = candidates.map(candidate => locate.indexOf(candidate));
  for (const [index, position] of positions.entries()) assert.ok(position >= 0, `missing candidate: ${candidates[index]}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'candidates are tried in this order');
  for (const check of ['is a git repository', 'The-Running-Dev/SubZeroDev.GitHub', 'scripts/New-Project.ps1', 'terraform.tfstate']) assert.ok(locate.includes(check), check);
  assert.match(locate, /\*\*Never clone it\.\*\*/);
});

test('setup-project keeps the publishing safeguards for a deferred language', () => {
  const preconditions = section('## 2. Preconditions', '## 3. Run the scripts');
  assert.ok(preconditions.includes("-not ((Get-Command ./scripts/New-Project.ps1).Parameters['Language'].Attributes | Where-Object Mandatory)"));
  assert.match(preconditions, /needs the language-neutral `New-Project\.ps1`\. Never pick a language to get past it\./);
  const never = driver.slice(driver.indexOf('## Never'));
  for (const rule of ['Pass `-Force` to either script.', 'Publish or preview without `New-Repository.ps1 -TargetScoped`.', 'Clone SubZeroDev.GitHub']) assert.ok(never.includes(rule), rule);
});

test('setup-project reports a deferred project without inventing decisions', () => {
  const report = driver.slice(driver.indexOf('## 5. Report'), driver.indexOf('## Never'));
  for (const line of ['`Implementation language: deferred`', '`Language-specific validation: not applicable`', '`Next: /agentkit:interview`']) assert.ok(report.includes(line), line);
  assert.match(report, /that is not a failure/);
  assert.match(report, /git state/);
  assert.ok(driver.slice(driver.indexOf('## Never')).includes('Choose, suggest or default a language the user did not give, or invent install, build, test, lint or run commands for a deferred project.'));
});
