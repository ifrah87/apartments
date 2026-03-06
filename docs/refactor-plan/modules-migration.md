# Modules Migration Plan (Guardrails)

This document tracks staged migration to `src/modules`.

## Scope

Initial domains:
- billing
- banking
- reporting

## Rules

- No route renames.
- No API contract breaks.
- Keep existing imports working via compatibility exports.
- Prefer extraction over rewrites.

## Execution style

1. Create module boundaries and entrypoints.
2. Move logic in small slices.
3. Keep legacy files as pass-through adapters until fully migrated.
4. Validate after every slice (typecheck + build + endpoint smoke checks).
