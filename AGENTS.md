## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- Treat `CLAUDE.md` as the shared project guidance for this repository. Read it before non-trivial work and follow it alongside this file.
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Shannon Pre-Customer Security Gate

- Shannon is available locally at `C:\Users\power\.codex\vendor_imports\KeygraphHQ-shannon` for future pre-customer proof-by-exploitation testing.
- Use the project `shannon` skill for Shannon planning/runs when available.
- Use Shannon only for LyVoX-owned local or staging environments with disposable data and explicit authorization. Never run it against production or real customer/payment data.
- Before first customer traffic, follow `docs/security/shannon-precustomer-runbook.md` and `security/shannon/lyvox-precustomer.example.yaml`.
- Treat Shannon findings as evidence to review and reproduce; do not ship with confirmed critical/high exploitable findings open.
