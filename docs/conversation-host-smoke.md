# Supported-host smoke: Codex, 2026-10-27

Only synthetic text was used. The user explicitly authorized a temporary chat,
fork, parent navigation and archival afterward. The helper's actual CLI prepared,
dispatched and recorded each operation in a temporary synthetic Notes archive;
no personal Notes or configured memory store was touched.

Current session contracts exposed `create_thread`, `fork_thread`,
`navigate_to_codex_page` and `read_thread` in `mcp__codex_app`. Workspace #56 is
still open: no capability report schema, graph API or VS Code memory command was
assumed. Tool exposure was recorded as contract evidence; the following calls
provide the functional evidence.

| Operation | Observed supported tool result |
| --- | --- |
| Selected handoff create | `create_thread` returned ready thread ID `01a17daa-f613-7531-8f56-3ec0688b92cb`, host `local`. Prompt contained operation `synthetic-root/native-create`, revision 1 and the attributed synthetic quote “Choose plain text.” |
| Explicit full-history fork | `fork_thread` with that source ID and `environment.type: same-directory` returned `status: created`, synchronization `complete`, source ID and child ID `01a17dab-a3f4-7582-bbe2-bf82be25f22c`. |
| Later attachment | Portable `attach-result` appended a distinct synthetic outcome source to `synthetic-child`, revision 2. It made no native history call. |
| Return | Prepared selected assistant summary “The synthetic child selected plain text.” with an archived byte span; parent bookmark “Before synthetic child experiment” and saved question were retained. `navigate_to_codex_page` targeting the immediate parent returned `navigated: true`. Receipt recorded success at revision 2. The outcome was not messaged to the parent. |
| Retry | Dispatching the completed `native-fork` identity returned success with `Call: null`; no second fork call was made. |
| Cleanup | `set_thread_archived` confirmed `archived: true` for both synthetic native chats. |

Creation and fork IDs came from ready `threadId` fields, not pending client IDs.
The chats were archived after the test; they are synthetic evidence, not ongoing
work tasks. The local archive remains uncommitted test scratch, not a push to the
user's private Notes repository.

Unknown creation, unsupported host/lookup, archive-success/host-refusal, changed
sources, explicit authorization, immutable revision replay and child -> parent
-> root bookmarks are covered by `tools/conversation-host.test.ts`. Those are
fixture results, not additional real-host claims. No real timeout was induced.
Codex has no verified creation lookup by operation ID here: without an observed
native ID the workflow remains unknown/manual and never blindly creates again.
No native attach, selective history clone, automatic messaging, graph projection
or VS Code memory command is claimed by this smoke.
