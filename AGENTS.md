# AGENTS.md

This file is the entrypoint for how an agent should operate in this repo.
Its primary job is document routing: decide what you are doing, then read the right docs first.

## 0) Always classify the request first

Before answering or changing code, classify the user’s request into one of:

- Implementation (code change)
- Design discussion (architecture / API / domain modeling)
- Bug investigation (diagnose + propose fix)
- Docs-only (write/update docs without code)
- Unknown (ask clarifying questions)

If classification is ambiguous, ask 1–3 clarifying questions _before_ doing anything else.

---

## 1) Document routing rules (mandatory)

### A. If you will implement (code changes, tests, refactors)

Read in this order:

1. `docs/ARCHITECTURE.md` — system boundaries, modules, responsibilities
2. `docs/RULE.md` — coding rules, constraints, conventions, workflow
3. (Optional) Any relevant module README / ADR / existing patterns referenced by ARCHITECTURE.md

Then proceed with implementation.

### B. If it is a design discussion (no code changes)

Read:

1. `docs/ARCHITECTURE.md`

Then respond with design options/tradeoffs aligned to the architecture.
If the discussion touches conventions, policies, or “how we do things here”, also read `docs/RULE.md`.

### C. If it is bug investigation

Read:

1. `docs/ARCHITECTURE.md` (to locate ownership/boundaries)
2. `docs/RULE.md` (to follow the repo’s debugging/testing expectations)

Then:

- Reproduce → explain root cause → propose minimal fix → verification plan.

### D. If it is docs-only work

Read:

- The target doc’s neighbors first (e.g., ARCHITECTURE references, ADRs)
- If you’re editing architecture-level docs, read `docs/ARCHITECTURE.md` first anyway.

---

## 2) “Stop conditions” (when to ask instead of guessing)

Stop and ask questions if any of these are true:

- Multiple interpretations would change APIs/data models/behavior
- You can’t identify the owning module/bounded context
- The request conflicts with `docs/ARCHITECTURE.md` or `docs/RULE.md`
- Success criteria is not testable/verifiable

---

## 3) Output expectations (how to respond)

### For implementation

- Brief plan (steps + how you will verify)
- Smallest diff that meets the request
- Verification notes (tests run / commands / expected outcomes)

### For design discussion

- 2–3 viable options
- Tradeoffs and failure modes
- Recommendation that matches `docs/ARCHITECTURE.md`
- Open questions (if any) and next steps

### For bug investigation

- Repro steps (or what’s missing)
- Root cause analysis
- Minimal fix proposal
- Verification plan

---

## 4) Where the detailed rules live

- Implementation/coding discipline, style rules, testing policy, commit conventions:
  → `docs/RULE.md`

- Project structure, modules, responsibilities, key flows:
  → `docs/ARCHITECTURE.md`
