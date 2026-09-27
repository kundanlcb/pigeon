# Global Engineering Guidelines

When writing, reviewing, or refactoring code for any project in this codebase, adhere strictly to the following principles to ensure the delivery of high-quality, maintainable, and robust software:

## 1. Modular & Clean Architecture
- **Modular Pattern:** Break down complex logic into small, reusable, and testable modules. Enforce a clear separation of concerns.
- **Best Folder Architecture:** Organize the codebase logically by feature or domain (e.g., `components`, `services`, `utils`, `types`, `hooks`). Follow the industry-standard architecture for the specific framework being used.

## 2. Modern, Secure, & Industry-Standard Code
- **Latest Code:** Always write code using the latest stable language features, APIs, and idioms (e.g., modern ECMAScript, latest React hooks, current Rust patterns).
- **No Deprecated/Vulnerable Code:** Never introduce code that relies on deprecated methods or known vulnerable libraries. If modifying existing code that uses deprecated APIs, upgrade it if possible.
- **Industry-Level Approach:** Apply established software design patterns (e.g., SOLID principles, DRY) and follow official style guides for the respective tech stack.

## 3. Performance Optimization
- **Efficiency:** Write code optimized for execution speed and low memory footprint. Choose appropriate data structures and algorithms.
- **Resource Management:** Avoid unnecessary renders, redundant network requests, or blocking the main thread. Use techniques like memoization, lazy loading, and debouncing where applicable.

## 4. Robustness & Operations
- **Comprehensive Error Handling:** Never swallow exceptions silently. Gracefully catch and handle errors, recover when possible, and present user-friendly error states. Use typed/custom errors for predictable handling.
- **Strategic Logging:** Implement structured, meaningful logging for critical paths, state changes, and errors to facilitate debugging and production observability.

## 5. Documentation
- **Self-Documenting Code:** Use clear, descriptive, and unambiguous names for variables, functions, and classes.
- **Inline Documentation:** Provide concise comments for complex business logic, non-obvious workarounds, and comprehensive docstrings (e.g., JSDoc, Rustdoc) for all public functions and APIs.
