# RULE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
   Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Keep docs/ARCHITECTURE.md in sync with meaningful changes

If your change alters system meaning (not just mechanics), you MUST update `docs/ARCHITECTURE.md` in the same PR/commit.

### Meaningful change examples (ARCHITECTURE update required)

- Module/package boundary changes or responsibility moves
- New/removed major component
- Contract changes: public APIs, message/event payloads, config schema, CLI interfaces
- Domain semantics changes: invariants, lifecycle/state transitions, renamed core concepts
- Data model changes with semantic impact (schemas/relations)
- Flow changes: orchestration steps, saga order, async messaging patterns
- Cross-cutting semantic changes: auth/permission rules, idempotency/retry semantics, caching semantics
- Operational meaning changes: deployment topology, ports, storage strategy, ingress/egress expectations

### Usually not meaningful (ARCHITECTURE update not required)

- Behavior-preserving refactors (extract function, renames local symbols, file moves without responsibility change)
- Formatting/linting/comment-only changes
- Test-only changes that don’t introduce new behavior

If in doubt: update the doc.

### Minimal doc edit rule

- Update only impacted sections; don’t rewrite the whole document.
- Keep vocabulary consistent with existing terms.
- Prefer small “Before → After” notes when the change is nuanced.

### Implementation checklist

- In PR/commit notes: `Architecture impact: YES/NO`
- If YES: update `docs/ARCHITECTURE.md` in the same change set.
- Verification: does ARCHITECTURE still describe module boundaries + flows + contracts accurately?

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
