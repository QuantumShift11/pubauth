# ADR 0001: Keep PubAuth standalone

## Status

Accepted

## Context

PubAuth is intended to evolve authentication and gateway authorization independently from any existing runtime codebase.

## Decision

PubAuth starts as a standalone repository.

It may learn from existing systems, but it must not copy runtime coupling or depend on product-specific implementation details.

## Consequences

- Clearer module boundaries
- Easier production hardening
- Easier migration planning
- Existing products can migrate gradually
- Initial duplicate concepts are acceptable while the platform stabilizes
