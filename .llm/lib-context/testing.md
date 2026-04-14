# Testing Guidelines

This document outlines the standard commands and patterns for testing the application. Always use these commands to verify changes before committing.

## 1. Frontend Unit Tests
Used for verifying store logic, services, and reactivity.
- **Command**: `cd frontend && npm test`
- **Engine**: Vitest
- **Scope**: Includes reactivity regression tests in `tests/unit/`.

## 2. End-to-End (E2E) Tests
Used for verifying full user workflows in the browser.
- **Command**: `cd frontend && npm run test:e2e`
- **Engine**: Playwright
- **Scope**: Covers folder management, note lifecycle, and virtual views.

## 3. Best Practices
- **Verify Reactivity**: In unit tests, use `$derived.by` to ensure reactive signals are firing, not just that values are correct.
- **Mocking**: When testing services, ensure mocks are aligned with the latest store APIs.
- **Clean State**: Always reset store state in `beforeEach` to avoid cross-test pollution.
