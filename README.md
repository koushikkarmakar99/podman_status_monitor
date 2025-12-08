# podman_status_monitor

## Overview

`podman_status_monitor` is a Visual Studio Code (VSCode) extension designed to monitor the status of Podman containers directly from your editor. It provides real-time insights of podman machine, if running or stopped. If the podman machine is not running, then it provides an option to start the machine from the IDE itself. This ensures less distraction and increased productivity.

## Features

- List running/stopped/exited Podman containers from VSCode
- Real-time status updates
- Configurable monitoring intervals
- Option to start the podman machine if stopped.
- In case of error, it gives option to reboot the machine.

## Tech Stack

- **Language:** TypeScript
- **Extension Host:** Visual Studio Code
- **Dependencies:** Podman (installed on your system), Node.js, and npm
- **Supported OS:** Windows (recommended)

## Getting Started

Follow these steps to set up the extension locally for development and debugging:

### 1. Clone the Repository

```bash
git clone https://github.com/koushikkarmakar99/podman_status_monitor.git
cd podman_status_monitor
```

### 2. Set Up the Local Development Environment

**Prerequisites:**
- Node.js >= 20.x
- npm >= 9.x
- Podman installed and available in PATH
- VSCode installed

**Install Podman:**
Refer to [Podman Installation Docs](https://podman.io/getting-started/installation) for your platform.

**Install dependencies:**

```bash
npm install
```

### 3. Open in VSCode

- Launch VSCode.
- Open the project folder (`File -> Open Folder...`).

### 4. Configure Extension

If applicable, edit configuration files in the workspace.

### 5. Launch the Extension

- Press `F5` in VSCode to launch the extension in a new Extension Development Host window.
- Use the Command Palette (`Ctrl+Shift+P`), search for commands provided by the extension, such as `Podman: Show Container Status`.

### Usage

- The extension displays statuses and details about your Podman containers within VSCode.
- Container status updates are shown in the status bar or a dedicated view.
- For command documentation, run `Podman: Help` in the Command Palette or see the extension’s documentation.

## Debugging

If you run into issues during development or usage:

1. **Check Extension Output:**  
   Open the Output panel in VSCode and select the extension’s channel for logs.

2. **Enable verbose logging:**  
   Set `"podmanStatusMonitor.logLevel": "debug"` in your VSCode `settings.json`.

3. **Verify Podman installation:**  
   Ensure you can run:
   ```bash
   podman ps
   ```
   from your terminal.

4. **Check dependencies:**  
   Run `npm install` if you see missing module errors.

5. **Check for configuration errors:**  
   Validate and update any configuration files.

6. **Review TypeScript compile errors:**  
   Compile with:
   ```bash
   npm run compile
   ```

7. **Ask for help:**  
   Open an issue [here](https://github.com/koushikkarmakar99/podman_status_monitor/issues).

## Contributing

PRs and Issues welcome!  
See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## License

[MIT](LICENSE)  
[Or your chosen license.]

## Acknowledgements

- [Podman documentation](https://podman.io/)
- [VSCode Extension API](https://code.visualstudio.com/api)
- [Credit helpers, other libraries, etc.]
