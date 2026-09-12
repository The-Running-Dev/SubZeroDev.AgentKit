# decision/2026-09-12-record-files-heading-renamed
Date: 2026-09-12
Anchor: 2026-09-12 — The id-to-path table is renamed `Where each record lives`, and heading uniqueness is a latent hazard
Status: accepted
StatedIn:

## Claim
A site is `<id> § <heading>`, so a heading duplicated inside one document makes every section
bearing that name unaddressable. `design/20-contract.md` carried two `The state set` headings; the
id-to-path table under § *Persisted schemas* is the renamed one because nothing cites it by name,
while five live citations across `tools/` and the decision log all mean the field-semantics section
under § *Types*. Nothing checks heading uniqueness within a document, so the hazard stays latent
until an absorption names a duplicated heading and `SiteAmbiguous` fires.
