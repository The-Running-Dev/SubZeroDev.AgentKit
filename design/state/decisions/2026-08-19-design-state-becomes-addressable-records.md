# decision/2026-08-19-design-state-becomes-addressable-records
Date: 2026-08-19
Anchor: 2026-08-19 — Design state becomes addressable records, and every restatement is either forbidden or checked
Status: accepted

## Claim
Design state becomes six kinds of separately-openable text record — Unit, Contract, Invariant, Decision, Question, WorkRef — under two commitments: current state is a fact with an address rather than a conclusion drawn from prose, and no generated prose is ever an input. Every restatement a record carries is either forbidden or mechanically checked, the orientation closure is one hop from a unit's own record excluding archival entries, and a divergence class is blocking only if it can be evaluated from the checkout alone. A freeze downgrades blocking classes to reported while exit 2 still stands, and an absent state set is could-not-evaluate, never clean.
