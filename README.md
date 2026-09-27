<div align="center">
  <img src="./app-icon.png" alt="Pigeon Logo" width="160" />
</div>

# Pigeon 🐦

Pigeon is a blazingly fast, lightweight, and modern API testing client built as an open-source alternative to Postman. Designed with a focus on speed, beautiful aesthetics, and developer experience, Pigeon uses the power of Tauri to deliver native desktop performance with a web technology stack.


## Features

- **Blazing Fast**: Built on Rust via Tauri, providing minimal memory footprint compared to Electron alternatives.
- **Modern UI/UX**: A sleek, responsive, and beautifully crafted interface supporting both Light and Dark modes.
- **Advanced Code Editing**: Integrated Monaco Editor (the engine behind VS Code) for precise JSON formatting, syntax highlighting, line numbers, and expand/collapse folding.
- **Environment Management**: Robust environment variable support (`{{variable_name}}`) seamlessly integrated throughout the app.
- **Postman Compatibility**: Seamlessly import your existing Postman Collections and Environment files.
- **cURL Integration**: Instantly copy requests as cURL commands to share with your team.
- **Cross-Platform**: Available natively on macOS, Windows, and Linux.

## Tech Stack

- **Framework**: [Tauri](https://tauri.app/) (Rust core)
- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Editor**: [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **npm** (or yarn/pnpm)
- **Rust** (Required for Tauri). Install via [rustup](https://rustup.rs/):
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

> For Windows and Linux specific Tauri prerequisites (like C++ build tools or webkit2gtk), check the [Official Tauri Setup Guide](https://v2.tauri.app/start/prerequisites/).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/pigeon.git
   cd pigeon
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

### Development

To start the development server and open the native Tauri application window:

```bash
npm run tauri dev
```
*Note: The first time you run this command, Cargo will download and compile the Rust dependencies which may take a few minutes. Subsequent builds will be much faster.*

### Building for Production

To build the optimized, standalone executable for your operating system:

```bash
npm run tauri build
```

Once the build finishes, you can find the binaries in the `src-tauri/target/release/bundle` directory:
- **macOS**: `.dmg` and `.app` files
- **Windows**: `.msi` and `.exe` files
- **Linux**: `.AppImage` and `.deb` files

## Project Structure

The codebase is highly modular and adheres to industry-standard patterns:

```text
src/
├── components/       # Reusable React components (UI and editors)
├── utils/            # Helper functions (URL parsing, syntax highlighters, file parsing)
├── store.ts          # Global Zustand state (Requests, Environments, Tabs)
├── App.tsx           # Main application layout and routing
├── index.css         # Global Tailwind v4 styles and theme definitions
```

## Contributing

We welcome contributions! Whether you're fixing a bug, adding a new feature, or improving documentation, your help is appreciated. 

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
