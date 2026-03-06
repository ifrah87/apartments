# Modules Refactor Guardrails

This folder is the target home for domain-based modules.

Initial priority domains:
- billing
- banking
- reporting

Refactor rules:
- Do not rename existing routes during early phases.
- Preserve backward compatibility with existing imports.
- Move logic incrementally behind stable interfaces.
