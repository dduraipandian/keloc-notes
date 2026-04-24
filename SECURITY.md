# Security Policy

## Supported Releases

This project is still in active pre-release development.

Right now, security fixes should be assumed to land on the latest development line rather than on a maintained set of older release branches.

## Reporting A Vulnerability

Please do **not** open a public GitHub issue for an undisclosed security vulnerability.

Instead, report it privately by email:

- `dduraipandian.dev@gmail.com`

When reporting, please include:

- a short description of the issue
- affected version or commit if known
- reproduction steps
- impact assessment if you have one
- any suggested mitigation

## Response Expectations

Best effort targets:

- acknowledgement within 7 days
- follow-up after initial triage when the issue is reproducible
- a fix or mitigation plan as soon as practical for confirmed issues

These are goals, not hard SLAs.

## Scope Notes

Particularly relevant issues for this project include:

- data exposure from local storage or backup flows
- import/export vulnerabilities
- unsafe filesystem handling
- vulnerabilities that could lead to arbitrary code execution
- issues that break the local-first trust model
