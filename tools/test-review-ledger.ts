import { existsSync, readFileSync } from 'node:fs';
import { parseOptions, requiredOption } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

// The review budget (AGENTS.shared.md § Review budget) for one deliverable, read from its
// markdown record so it survives sessions, models and vendors. Read-only.
export const options = { path: { type: 'string' }, quiet: { type: 'boolean' } } as const;

export const levels = ['Syntax', 'Unit', 'Integration', 'Entry point', 'End to end'] as const;
const results = ['passed', 'failed', 'not run', 'not applicable'];
const severities = ['BLOCKING', 'NON-BLOCKING', 'SPECULATIVE', 'DUPLICATE'];
const statuses = ['open', 'resolved', 'not sustained', 'accepted risk', 'tracked'];
const risks = ['LOW', 'MEDIUM', 'HIGH'];

interface Section { Id: string; Fields: Map<string, string> }
interface Finding { Id: string; Severity: string; Status: string }
interface Problem { Check: string; Section: string; Message: string }
interface Budget { Used: number; Allowed: number; Remaining: number }
export interface LedgerResult {
  State: string; Next: string; Deliverable: string; Risk: string;
  Reviews: Budget; Corrections: Budget; NextReview: string;
  OpenBlocking: string[]; Findings: Finding[]; Verification: Record<string, string>; Problems: Problem[];
}

const blank = (value: string | undefined) => !value?.trim();
const result = (value: string | undefined) => (value ?? '').split(/\s+[—-]\s+/)[0].trim().toLowerCase();
const detail = (value: string | undefined) => { const at = (value ?? '').search(/\s[—-]\s/); return at < 0 ? '' : (value ?? '').slice(at + 3).trim(); };
const budget = (Used: number, Allowed: number): Budget => ({ Used, Allowed, Remaining: Math.max(Allowed - Used, 0) });

export function parseLedger(text: string): { Header: Map<string, string[]>; Sections: Section[] } {
  const header = new Map<string, string[]>(), sections: Section[] = [];
  let current: Section | null = null;
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const heading = /^##\s+(\S+)/.exec(line);
    if (heading) { current = { Id: heading[1], Fields: new Map() }; sections.push(current); continue; }
    const field = /^([A-Z][A-Za-z ]*?):\s?(.*)$/.exec(line);
    if (!field) continue;
    if (current) current.Fields.set(field[1], field[2].trim());
    else header.set(field[1], [...(header.get(field[1]) ?? []), field[2].trim()]);
  }
  return { Header: header, Sections: sections };
}

export function evaluateLedger(text: string): LedgerResult {
  const { Header, Sections } = parseLedger(text);
  const problems: Problem[] = [];
  const problem = (Check: string, Section: string, Message: string) => problems.push({ Check, Section, Message });
  const risk = result(Header.get('Risk')?.[0]).toUpperCase();
  if (!risks.includes(risk)) problem('BadRisk', 'header', 'Risk must be LOW, MEDIUM or HIGH; it is inferred from the change, never asked.');
  const authorized = (Header.get('Authorized') ?? []).filter(value => !blank(detail(value)));
  const cancelled = (Header.get('Cancelled') ?? []).some(value => !blank(value));

  const verificationSection = Sections.find(section => section.Id === 'Verification');
  const verification: Record<string, string> = {};
  const required = risk === 'HIGH' ? [...levels, 'Risk check'] : [...levels];
  for (const level of required) {
    const value = verificationSection?.Fields.get(level);
    if (value === undefined) { verification[level] = 'not assessed'; continue; }
    const outcome = result(value);
    verification[level] = outcome;
    if (!results.includes(outcome)) problem('BadValue', level, `'${outcome}' is not passed, failed, not run or not applicable.`);
    else if (blank(detail(value))) problem(outcome === 'passed' || outcome === 'failed' ? 'MissingEvidence' : 'MissingReason', level, `${outcome} needs ${outcome === 'passed' || outcome === 'failed' ? 'its evidence' : 'its reason'} after the dash.`);
  }

  const order = Sections.map(section => section.Id);
  const passes = Sections.filter(section => /^R\d+$/.test(section.Id));
  const corrections = Sections.filter(section => /^C\d+$/.test(section.Id));
  const findings = Sections.filter(section => /^F\d+$/.test(section.Id));
  // Corrections before the first review are ordinary building; the budget counts those after it.
  const counted = passes.length ? corrections.filter(correction => order.indexOf(correction.Id) > order.indexOf(passes[0].Id)) : [];
  const reviews = budget(passes.length, 2 + authorized.length), fixes = budget(counted.length, 1 + authorized.length);
  if (passes.length > reviews.Allowed) problem('OverBudget', passes[reviews.Allowed].Id, `${passes.length} review passes against an allowance of ${reviews.Allowed}; more needs the user's authorization.`);
  if (counted.length > fixes.Allowed) problem('OverBudget', counted[fixes.Allowed].Id, `${counted.length} corrections after review against an allowance of ${fixes.Allowed}; fixes are consolidated into one.`);
  if (passes[0] && passes[0].Fields.get('Kind') !== 'review') problem('BadValue', passes[0].Id, 'The first pass is Kind: review.');
  const kinds = new Map(passes.map(pass => [pass.Id, pass.Fields.get('Kind') ?? '']));

  const seen = new Map<string, string>();
  for (const finding of findings) {
    const f = finding.Fields, id = finding.Id, severity = f.get('Severity') ?? '', status = f.get('Status') ?? '';
    if (!severities.includes(severity)) problem('BadValue', id, `Severity '${severity}' is not one of ${severities.join(', ')}.`);
    if (!statuses.includes(status)) problem('BadValue', id, `Status '${status}' is not one of ${statuses.join(', ')}.`);
    const raised = f.get('Raised in') ?? '';
    if (raised !== 'verification' && !kinds.has(raised)) problem('BadReference', id, `Raised in '${raised}' names no review pass.`);
    if (severity === 'BLOCKING' && blank(f.get('Evidence'))) problem('MissingEvidence', id, 'A BLOCKING finding needs evidence; without it, it is SPECULATIVE.');
    if (f.has('Reopened by') && blank(f.get('Reopened by'))) problem('ReopenWithoutEvidence', id, 'A finding is reopened only with new evidence.');
    if (status === 'accepted risk' && blank(f.get('Accepted'))) problem('AcceptedWithoutUser', id, "Accepted risk needs the user's own words in Accepted:.");
    if (severity === 'DUPLICATE') {
      const original = f.get('Duplicate of') ?? '';
      if (original === id || !findings.some(other => other.Id === original)) problem('BadDuplicate', id, `Duplicate of '${original}' names no other finding.`);
      continue;
    }
    const key = `${(f.get('Where') ?? '').trim().toLowerCase()}|${(f.get('Claim') ?? '').trim().toLowerCase()}`;
    if (seen.has(key) && blank(f.get('Reopened by'))) problem('UnmarkedDuplicate', id, `Repeats ${seen.get(key)}; mark it DUPLICATE, or reopen that finding with new evidence.`);
    else seen.set(key, id);
    if (kinds.get(raised) === 're-review' && status === 'open' && severity !== 'BLOCKING') problem('OutsideReReview', id, 'A re-review opens only BLOCKING findings with evidence; track the rest in one issue.');
  }

  const listed: Finding[] = findings.map(finding => ({ Id: finding.Id, Severity: finding.Fields.get('Severity') ?? '', Status: finding.Fields.get('Status') ?? '' }));
  const openBlocking = listed.filter(finding => finding.Severity === 'BLOCKING' && finding.Status === 'open').map(finding => finding.Id);
  const lastPass = passes.length ? order.lastIndexOf(passes[passes.length - 1].Id) : -1;
  const correctedSincePass = corrections.some(correction => order.indexOf(correction.Id) > lastPass) && passes.length > 0;
  const nextReview = reviews.Remaining === 0 ? 'none' : !passes.length ? 'review' : correctedSincePass ? 're-review' : 'none';
  const reviewed = risk === 'MEDIUM' || risk === 'HIGH';

  const done = (State: string, Next: string): LedgerResult => ({
    State, Next, Deliverable: Header.get('Deliverable')?.[0] ?? '', Risk: risk, Reviews: reviews, Corrections: fixes,
    NextReview: State === 'CANCELLED' || State === 'Invalid' ? 'none' : nextReview, OpenBlocking: openBlocking, Findings: listed, Verification: verification, Problems: problems,
  });
  if (cancelled) return done('CANCELLED', 'Nothing — the user cancelled this deliverable.');
  if (problems.length) return done('Invalid', 'Correct the record: ' + problems.map(p => `${p.Section} ${p.Check}`).join(', ') + '.');
  const failed = Object.keys(verification).filter(level => verification[level] === 'failed');
  if (openBlocking.length || failed.length) {
    const what = [...openBlocking, ...failed].join(', ');
    return fixes.Remaining ? done('CORRECTING', `Correct ${what} in one change and record it as C${corrections.length + 1}.`)
      : done('BLOCKED', `${what} still stands and the correction budget is spent: the user authorizes more, accepts the risk, or cancels.`);
  }
  const unassessed = Object.keys(verification).filter(level => verification[level] === 'not assessed');
  if (unassessed.length) return done('VERIFYING', `Run and record: ${unassessed.join(', ')}.`);
  const notRun = Object.keys(verification).filter(level => level !== 'End to end' && verification[level] === 'not run');
  if (notRun.length) return done('BLOCKED', `${notRun.join(', ')} did not run: ${notRun.map(level => detail(verificationSection?.Fields.get(level))).join('; ')}.`);
  if (reviewed && !passes.length) return done('VERIFYING', `Risk is ${risk}: run the one independent review.`);
  if (reviewed && correctedSincePass) return nextReview === 're-review' ? done('VERIFYING', 'Re-review the corrections and the findings they fix, nothing else.')
    : done('BLOCKED', 'A correction has no re-review left: the user authorizes one or accepts the risk.');
  const accepted = listed.some(finding => finding.Status === 'accepted risk');
  if (verification['End to end'] === 'not run') return done('READY_FOR_EXECUTION', `Real end-to-end execution needs the user's go-ahead: ${detail(verificationSection?.Fields.get('End to end'))}.`);
  return accepted ? done('ACCEPTED_RISK', 'Nothing — the remaining findings are accepted risk in the user\'s words.') : done('COMPLETE', 'Nothing — this is complete.');
}

export function reviewLedger(path: string): LedgerResult {
  if (!existsSync(path)) {
    const empty = budget(0, 0);
    return { State: 'NotEvaluated', Next: `No review record at ${path}: write its header first.`, Deliverable: '', Risk: '', Reviews: empty, Corrections: empty, NextReview: 'none', OpenBlocking: [], Findings: [], Verification: {}, Problems: [] };
  }
  return evaluateLedger(readFileSync(path, 'utf8'));
}

export const ledgerExitCode = (state: string) => state === 'NotEvaluated' ? 2 : state === 'Invalid' ? 1 : 0;

if (isMain(import.meta.url)) await main(() => {
  const values = parseOptions(options);
  const ledger = reviewLedger(requiredOption(values.path, 'path'));
  if (!values.quiet) {
    process.stderr.write(`${ledger.State}: ${ledger.Next}\nReviews ${ledger.Reviews.Used}/${ledger.Reviews.Allowed}, corrections ${ledger.Corrections.Used}/${ledger.Corrections.Allowed}, next review: ${ledger.NextReview}\n`);
    for (const p of ledger.Problems) process.stderr.write(`  [${p.Check}] ${p.Section} - ${p.Message}\n`);
  }
  writeJson(ledger);
  process.exitCode = ledgerExitCode(ledger.State);
});
