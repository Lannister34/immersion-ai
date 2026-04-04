# Engineering Standards

These rules are normative. A pull request that violates them should be rejected.

## 1. State Ownership

- The backend is the only source of truth for persisted data.
- Chats, settings, prompts, characters, scenarios, and other file-backed resources must not have a canonical copy in frontend state.
- Frontend stores may hold UI state and disposable query cache only. They must not become a shadow database.
- After every write, the backend must return the canonical resource or snapshot. The frontend must replace or invalidate state, not hand-merge it in multiple places.
- Reload, refresh, and external file changes must not depend on frontend memory to keep data consistent.

## 2. Boundaries and Ownership

- Every business rule must have one owner module.
- Business logic must not be duplicated across backend routes, frontend hooks, stores, components, or utility files.
- File IO belongs to backend infrastructure and repository modules only.
- Components must not call `fetch` directly. UI talks to the backend through the API and query layers only.
- Cross-domain access must go through an explicit public API. Do not reach into another domain's internals for convenience.

## 3. Code Design

- Prefer refactor over layering. If a change touches repeated or adjacent logic, extract or consolidate it in the same change when practical.
- Page components are thin orchestrators. Hooks coordinate behavior. Pure logic lives in domain or lib modules.
- Do not use `useEffect` to repair divergent state after the fact. Fix the ownership model or data flow.
- Do not add silent fallbacks that hide broken invariants or data loss.
- By the second real use of shared logic, extract it. A third copy is not allowed.
- Public modules must expose clear, typed contracts. Avoid anonymous object shapes in public function signatures.

## 4. Problem Solving

- Start from the invariant and the true source of truth before writing code.
- Reproduce the defect with exact steps or data before implementing a fix.
- Fix the owner seam, not the most visible symptom.
- Remove obsolete workaround code in the same change when it is safe to do so.
- Add regression coverage for the touched invariant, or document why automated coverage is not yet possible.

## 5. Review Gate

Reviewers must reject a change when any of the following is true:

- It introduces server-owned durable state into a frontend store or ad hoc cache.
- It duplicates a business rule that already exists elsewhere.
- It layers new code on top of broken structure instead of refactoring the owner module.
- It leaves source of truth, ownership, or invalidation behavior unclear.
- It changes boundaries, framework assumptions, or ownership without an ADR.
- It changes high-risk flows without regression coverage or an explicit testing rationale.

## 6. Default Architecture Direction

- Server-authoritative state model.
- Domain-first module boundaries.
- Contracts-first IO boundaries.
- Functional core, imperative shell.
- Review for long-term maintainability over short-term patch speed.
