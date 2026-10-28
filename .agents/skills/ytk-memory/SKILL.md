---
name: ytk-memory
description: Use YTK Memory for meaningful project work and questions about saved project memory.
---

<!-- Managed by ytk-memory-init:codex-skill -->

# YTK Memory workflow

## Scope

This workflow belongs to project `agent-harness-lab`. The configured MCP server is already scoped to this project and its SQLite database. Do not try to use it to read or write another project.

## When to use this workflow

Use it for meaningful coding or investigation work in this project, and whenever the user asks what is saved in YTK Memory. Trivial conversation that does not need project context does not require a memory session. Use the configured YTK Memory MCP tools for memory questions; do not inspect the SQLite file directly as a substitute.

## Start of work

1. Call `memory_session_start` once without a query when a meaningful task begins; it returns a compact project briefing. For a follow-up in the same task, keep using that session instead of starting a new one. Use `memory_search` with a short topic when you need more targeted context.
2. Keep the returned `sessionId`. Pass it to every `memory_save` made during that task and to `memory_session_finish`.
3. Treat returned entries as evidence. An empty result means that the query found no relevant entries; it does not mean the database is empty.

## Search carefully

- Use a short, focused keyword or phrase, preferably one topic per `memory_search` call (for example, `Go` or `installer`). Avoid combining many synonyms or writing a long question as one query.
- If a search is empty, retry with a simpler or more distinctive term. Try alternate wording or language separately when useful, then report that no matching entry was found if those searches are also empty.
- Do not infer that the database is empty or count all entries from search results. These tools do not provide a full listing or total-count operation.
- Use `memory_get` to read a result by ID when its preview is insufficient.
- Keep `limit` between 1 and 100 and `maxChars` between 100 and 20000.

## Review and correction

- Use `memory_review_list` to find memories due for review. After checking each memory against current evidence, call `memory_review_complete` with a future RFC3339 `nextReviewAt` and a concise reason.
- Use `memory_correct` when a stored fact needs correction. It creates a new active revision, marks the old revision superseded, and preserves their `supersedes` relation. Supply only the changed title or content; omitted fields are retained.
- Use `memory_relations` to inspect a memory's related entries and follow version links before explaining how knowledge changed.
- Never mark a memory reviewed or correct it without checking the relevant evidence first. Project and configured area scope are enforced by the tools.

## Persist durable findings

Save reusable decisions, discoveries, patterns, or preferences with a stable `subjectKey`. Do not store secrets, credentials, tokens, unnecessary personal data, or raw conversations. Never store unverified hypotheses as facts.

## Finish or pause work

Before ending a meaningful task, call `memory_session_finish` with the same `sessionId`. Include a concise handoff when there are useful findings or unfinished work.
