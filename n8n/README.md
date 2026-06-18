# n8n workflows

Version-controlled exports of the async workflows (PRD §22). Import these into
`https://n8n.truongvietanh.com`.

| Workflow | Milestone | Purpose |
|---|---|---|
| `WF-EndSession.json` | M3 | On session end: recompute mastery, set Leitner interval |
| `WF-Ingest.json` | M6 | KG/content ingest → review_queue (RAG chunk/embed) |
| `WF-ReviewQueue.json` | M4 | Approval routing |
| `WF-Reports.json` | M6 | Parent (Zalo) / teacher reports |
| `WF-Alerts.json` | M6 | Safety alerts → human verify (never auto to parents) |
| `WF-Consent.json` | M6 | Consent lifecycle / withdrawal → stop processing |
| `WF-QuestionStats.json` | M5 | p_value / discrimination → retire questions |
| `WF-SpacedRep.json` | M5 | Leitner daily scheduler (1→3→7→21) |

Export from n8n: workflow → ⋯ → Download. Commit the JSON here.
