# Pigeon

Pigeon is a powerful, local-first API testing and debugging client built with Tauri and React. It provides a dense, developer-focused interface designed for efficiency, speed, and privacy. 

## Features
- **Local-first**: All data stays on your machine. Secrets are securely stored in the native OS keychain.
- **High Performance**: Built with Rust (Tauri) and React for minimal overhead and blazing fast execution.
- **Security Scanner**: Built-in automated checks for SQL injection, XSS, SSRF, verb tampering, and broken access controls.
- **Load Testing**: Integrated load testing to verify API performance under stress.
- **Advanced Authentication**: Full support for OAuth 2.0, Bearer, Basic, and API Key authentication schemes.

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Run the development server: `npm run tauri dev`
4. Build for production: `npm run tauri build`

## Architecture
- **Frontend**: React, Zustand (state), Vite
- **Backend**: Rust, Tauri
- **Security**: 
  - OS Keychain (`keyring` crate) for credential storage
  - **CSP (Content Security Policy)**: Pigeon uses a strict CSP. Note that `connect-src` is intentionally left permissive (`https: http: ws: wss:`) because the core function of the app is to make arbitrary user-specified network requests. `script-src` includes `'unsafe-eval'` strictly to support the sandboxed Javascript environment (which executes in an opaque-origin `blob:` iframe) for pre-request and test scripts.

## License
MIT License
