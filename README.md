# Podman Status Monitor

[![Version](https://img.shields.io/visual-studio-marketplace/v/karmakars.podman-status-monitor)](https://marketplace.visualstudio.com/items?itemName=karmakars.podman-status-monitor) [![Installs](https://img.shields.io/visual-studio-marketplace/i/karmakars.podman-status-monitor)](https://marketplace.visualstudio.com/items?itemName=karmakars.podman-status-monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Visual Studio Code extension that monitors and manages Podman machines directly from your editor, eliminating context switching and boosting productivity.

## ✨ Features

### 🔍 Real-Time Machine Status
Monitor your Podman machine status at a glance with live updates in the VS Code status bar:
- **Running**: 🟢 Podman: Running (1/1) machine(s)
- **Stopped**: 🔴 Podman: Stopped (0/2) machine(s)
- **Hover** over the status bar to see detailed information about each machine

### 🚀 Quick Machine Management
- **Start Machines**: Start stopped machines directly from VS Code with a single click
- **Multi-Machine Support**: Select specific machines to start or start all at once
- **Create Machines**: Initialize new Podman machines without leaving your editor
- **Status Refresh**: Right-click the status bar to manually refresh machine status

### 🛠️ Smart Detection
- Automatically detects Podman installation
- Prompts with installation links if Podman is not found
- Identifies missing machines and offers quick creation options
- Detects when system reboot is required for machine startup

### 💻 Platform Support
- Windows (with WSL2 or Hyper-V)
- macOS
- Linux (status monitoring)

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS) to open Extensions
3. Search for **"Podman Status Monitor"**
4. Click **Install**

### Manual Installation (VSIX)
1. Download the `.vsix` file from the [Releases](https://github.com/koushikkarmakar99/podman_status_monitor/releases) page
2. Open VS Code Extensions view (`Ctrl+Shift+X`)
3. Click the `...` menu at the top-right
4. Select **Install from VSIX...**
5. Choose the downloaded `.vsix` file

## 🚀 Getting Started

1. **Install the extension** following the instructions above
2. The extension **activates automatically** when VS Code starts
3. Check the **status bar** (bottom-left) for Podman machine status
4. **Hover** over the status to see machine details
5. **Click** the status to start stopped machines or create new ones
6. **Right-click** to refresh the status

### First-Time Setup
If Podman is not installed, the extension will:
- Display a notification with installation instructions
- Provide direct links to official Podman documentation
- Guide you through machine creation once Podman is installed

## 📋 Requirements

- **Podman** 4.0 or higher
- **VS Code** 1.95.0 or higher
- **Operating System**:
  - Windows 10/11 with WSL2 or Hyper-V
  - macOS 11.0 (Big Sur) or higher
  - Linux (any distribution with Podman support)

## 🎯 Usage Examples

### Starting a Stopped Machine
1. When machines are stopped, a notification appears: *"Some Podman machines are not running. Would you like to start them?"*
2. Click **Start Machines**
3. Select the machine(s) you want to start
4. Monitor progress in the notification area

### Creating a New Machine
1. If no machines exist, click the status bar notification
2. Click **Create Machine**
3. Enter a machine name (or press Enter for default: `podman-machine-default`)
4. Wait for initialization to complete
5. Optionally start the machine immediately

### Multi-Machine Management
- View all machine statuses by hovering over the status bar
- Start multiple machines simultaneously by selecting them from the quick pick menu
- Individual machine status is displayed in a formatted table

## ⚙️ Extension Settings

This extension currently works out-of-the-box with no configuration required. Future versions will include:
- Custom status bar position
- Auto-start preferences
- Notification frequency settings
- Machine naming conventions

## 🐛 Known Issues

- **Failed to create podman machine**: While creating podman machine user may face `Failed to create Podman machine 'podman-machine-default': Error: vm "<machine name>" already exists on hypervisor`. This happens if users unsuccessfully removed an old podman machine and tried to create a new machine with a same name. This occurs as the WSL distro was not unregistred successfully when the podman machine was deleted. To fix this issue. Open a terminal and run the below command -
```PowerShell
wsl --unregister <machine name>"
```

This item is in the TODO list to automate the fix.

For a complete list, see [Issues](https://github.com/koushikkarmakar99/podman_status_monitor/issues).

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Report Bugs**: [Open an issue](https://github.com/koushikkarmakar99/podman_status_monitor/issues/new?template=bug_report.md)
2. **Request Features**: [Submit a feature request](https://github.com/koushikkarmakar99/podman_status_monitor/issues/new?template=feature_request.md)
3. **Submit PRs**: See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines

### Development Setup
```bash
# Clone the repository
git clone https://github.com/koushikkarmakar99/podman_status_monitor.git

# Install dependencies
cd podman_status_monitor
npm install

# Compile and watch
npm run watch

# Press F5 in VS Code to start debugging
```

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes in each version.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Podman](https://podman.io/) - The amazing container engine
- [VS Code Extension API](https://code.visualstudio.com/api) - Microsoft's excellent extension framework
- All contributors who help improve this extension

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/koushikkarmakar99/podman_status_monitor/issues)

---

**Made with ❤️ for the containerization community**

[⬆ Back to top](#podman-status-monitor)