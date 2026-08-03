---
name: Story
about: A change worth doing that is not a bug, and not a slice of an existing design
title: ''
labels: enhancement
---

**What changes, and for whom.** Two or three sentences. What can someone do afterwards that they cannot do now?

**Why now.** What makes this worth doing ahead of the other things.

### Done when

- [ ] <observable, checkable without judgement>

---
<details><summary><b>Agent instructions</b> — read before starting</summary>

- **Authority:** this issue, and only until it needs more. If it turns out to need a contract, a schema, or a public interface, **it is not a story** — stop and run `/brief-check`, and let it become a brief.
- **Stop if:** it needs more than one slice. Say so rather than growing the change inside one issue.
- **Check `design/` first.** If the design docs already govern the area this touches, they outrank this issue — work from them, not from here.
- **Do not** start implementation from this issue if it has no `Done when` a reader could check without judgement. Ask for one instead.
</details>
