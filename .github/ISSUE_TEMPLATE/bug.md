---
name: Bug
about: Something behaves differently from what the contract, the docs, or a test says
title: ''
labels: bug
---

**Symptom** — one sentence someone else would recognise.

Observed on <branch, version, or environment>. Expected <what>, got <what>.

### Reproduce

1.
2.

### Done when

- [ ] A regression test fails without the fix and passes with it

---
<details><summary><b>Agent instructions</b> — read before starting</summary>

- **Authority:** the failing test is the specification. If no test can express the symptom, say so *before* writing a fix — an unreproducible bug is a diagnosis task, not an implementation one.
- **Out of scope:** adjacent defects noticed while fixing this one. File them separately; do not widen the change.
- **Stop if:** the fix needs a contract, schema, or public-interface change. That is an amendment, not a bug fix.
- **Verify by reverting the fix** and confirming the test fails. A test that passes with and without the fix guards nothing.
- **Beware a fix that only changes the odds.** If the symptom was intermittent and is now "not reproducing", say how many runs that is over and what the cause was — a race hidden is not a race fixed.
</details>
