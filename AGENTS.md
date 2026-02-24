# AGENTS.md

Entrypoint for how an agent should operate in this repo.
Primary job: document routing. Decide what you are doing, then read only the right docs first.

## 0) Classify the request

- Implementation (code change)
- Design discussion (architecture / API / domain modeling)
- Bug investigation
- Docs-only
- Unknown → ask 1–3 clarifying questions first

## 1) Document routing (mandatory)

### A. Implementation (code/tests/refactor)

Read in this order:

1. `docs/ARCHITECTURE.md`
2. `docs/RULE.md`
3. Relevant `docs/module/*.md` selected via `docs/ARCHITECTURE.md` routing

Then implement.

If your change is “meaningful” (semantics, boundaries, contracts, flows), update `docs/ARCHITECTURE.md` in the same change set (see `docs/RULE.md`).
If a module is added/changed, update its `docs/module/*.md` using `docs/module/TEMPLATE.md`.

### B. Design discussion (no code changes)

Read:

1. `docs/ARCHITECTURE.md`
2. Relevant `docs/module/*.md` selected via `docs/ARCHITECTURE.md` routing

If the discussion touches repo conventions/policies, also read `docs/RULE.md`.

### C. Bug investigation

Read:

1. `docs/ARCHITECTURE.md`
2. `docs/RULE.md`
3. Relevant `docs/module/*.md` selected via `docs/ARCHITECTURE.md` routing

Then: reproduce → root cause → minimal fix → verification plan.

### D. Docs-only

Read the target doc + its neighbors.
If editing architecture-level docs, read `docs/ARCHITECTURE.md` first.

## 2) Stop conditions (ask instead of guessing)

- Multiple interpretations would change APIs/data models/behavior
- You can’t identify owning module/boundary
- Conflicts with `docs/ARCHITECTURE.md` or `docs/RULE.md`
- Success criteria isn’t verifiable

## 3) Output expectations

Implementation: plan + smallest diff + verification notes  
Design: options + tradeoffs + recommendation aligned to ARCHITECTURE  
Bug: repro + root cause + minimal fix + verification

## 4) Canonical docs

Detailed implementation rules: `docs/RULE.md`  
Feature routing & boundaries: `docs/ARCHITECTURE.md`  
Feature details and usage: `docs/module/*.md`

## 5) Routing hints (repo-specific)

- If request mentions job/worker/orchestration/retry/requeue/monitoring:
  - Read `docs/module/job-orchestration.md` first (after ARCHITECTURE/RULE based on task type).
- Priority implementation checklist for orchestration MVP:
  - `docs/todo/priority1-job-orchestration-implementation-checklist.md`
