# Contributing to podman_status_monitor

Welcome! We appreciate your interest in contributing to the **podman_status_monitor** VSCode extension. This guide will help you get started.

---

## How Can I Contribute?

### 1. Reporting Issues
- For bugs or feature requests, [open an issue](https://github.com/koushikkarmakar99/podman_status_monitor/issues).
- Please include as much detail as possible (screenshots, logs, steps to reproduce, VSCode and Podman versions).

### 2. Suggesting Enhancements
- Suggestions for new features or improvements are welcome!
- Before opening a new suggestion, check if a similar issue/pr already exists.

---

## Development Workflow

### 1. Fork & Clone

1. Fork this repository to your GitHub account.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/podman_status_monitor.git
   cd podman_status_monitor
   ```

### 2. Setup & Build

1. Install Node.js and npm.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run compile
   ```

### 3. Run & Debug

- Open the folder in VSCode.
- Press `F5` to launch the extension in a new Extension Development Host.

### 4. Submit a Pull Request

1. Create a new feature/fix branch.
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Commit your changes.
   - Use clear, descriptive commit messages.
3. Push your branch and open a Pull Request:
   - Explain your changes clearly, and reference any related issues.

---

## Code Style & Guidelines

- Use [TypeScript](https://www.typescriptlang.org/)
- Be consistent with formatting. Run:
  ```bash
  npm run lint
  ```
- Write clear, readable code and comments when necessary.
- Write/update tests if adding new features or fixing bugs.

---

## Code of Conduct

Please be respectful and constructive in all communications. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) if available.

---

## Additional Resources

- [VSCode Extension Docs](https://code.visualstudio.com/api)
- [Podman Documentation](https://podman.io/getting-started/)
- [GitHub Guides](https://guides.github.com/)

---

Thank you for helping make **podman_status_monitor** better!