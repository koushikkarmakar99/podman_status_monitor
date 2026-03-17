import * as vscode from 'vscode';
import * as os from 'node:os';
import PodmanManager from './classes/podman-manager';
import Logger from './classes/logger';
import UnifiedStatusBar from './classes/unified-statusbar';

let statusCheckInterval: NodeJS.Timeout | undefined;

const unifiedStatusBar = new UnifiedStatusBar();

export async function activate(context: vscode.ExtensionContext) {
    Logger.info('Activating Podman Status Monitor extension');
    const podmanManager = new PodmanManager(); // Create instance of PodmanManager
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 80);
    statusBar.text = '$(loading~spin) Checking Podman status...';
    statusBar.tooltip = await podmanManager.toolTipStatus();
    statusBar.command = 'podman.refreshStatus';
    unifiedStatusBar.updateUnifiedStatusBar(statusBar);
    statusBar.show();

    const autoRefreshStatus = vscode.commands.registerCommand('podman.autoRefreshStatus', async () => {
        statusBar.tooltip = await podmanManager.toolTipStatus();
        const tooltipStatusAtT0 = statusBar.tooltip; // tooltipStatus at t=0s
        // If there is a change in statusBar.tooltip, call podmanManager.checkPodmanStatus(statusBar)
        setTimeout(async () => {
            statusBar.tooltip = await podmanManager.toolTipStatus();
            const tooltipStatusAtT10 = statusBar.tooltip; // tooltipStatus at t=10s

            // Compare the two tooltip statuses
            if (tooltipStatusAtT0 !== tooltipStatusAtT10) {
                await podmanManager.checkPodmanStatus(statusBar);
                Logger.info('Podman status changed, updated status bar.');
            }

        }, 10000);
    });

    const refreshStatus = vscode.commands.registerCommand('podman.refreshStatus', async () => {
        statusBar.text = '$(loading~spin) Refreshing...';
        await podmanManager.checkPodmanStatus(statusBar);
        statusBar.tooltip = await podmanManager.toolTipStatus();
        Logger.info(`Podman status refreshed by user: ${os.userInfo().username}`);
    });

    const startPodman = vscode.commands.registerCommand('podmanStatusMonitor.startPodman', async (machineName: string) => {
        statusBar.text = `$(loading~spin) Starting ${machineName}...`;
        await podmanManager.startPodmanMachine(machineName);
        statusBar.tooltip = await podmanManager.toolTipStatus();
        Logger.info(`Podman machine ${machineName} started by user: ${os.userInfo().username}`);
    });

    const stopPodman = vscode.commands.registerCommand('podmanStatusMonitor.stopPodman', async (machineName: string) => {
        statusBar.text = `$(loading~spin) Stopping ${machineName}...`;
        await podmanManager.stopPodmanMachine(machineName);
        statusBar.tooltip = await podmanManager.toolTipStatus();
        Logger.info(`Podman machine ${machineName} stopped by user: ${os.userInfo().username}`);
    });

    const deletePodmanMachine = vscode.commands.registerCommand('podmanStatusMonitor.deletePodmanMachine', async (machineName: string) => {
        statusBar.text = `$(loading~spin) Deleting ${machineName}...`;
        await podmanManager.deletePodmanMachine(machineName);
        statusBar.tooltip = await podmanManager.toolTipStatus();
        Logger.info(`Podman machine ${machineName} deleted by user: ${os.userInfo().username}`);
    });

    const rebootMachine = vscode.commands.registerCommand('podmanStatusMonitor.rebootMachine', async () => {
        const selection = await vscode.window.showQuickPick(['Reboot Machine', 'Cancel'], {
            placeHolder: 'What would you like to do?'
        });

        if (selection === 'Reboot Machine') {
            statusBar.text = `$(loading~spin) Rebooting...`;
            const command: string = os.platform() === 'win32' ? 'shutdown /r /t 5' : 'sudo reboot';
            const { stdout, stderr, exitCode } = await podmanManager.runCommand(command);
            Logger.info(`Reboot command stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

            if (exitCode === 0) {
                vscode.window.showInformationMessage('Machine will reboot in 5 seconds.', 'Close');
                Logger.info('Machine reboot initiated successfully.');
            } else {
                vscode.window.showErrorMessage(`Failed to reboot machine: ${stderr}`, 'Close');
                Logger.error(`Failed to reboot machine: ${stderr}`);
            }
        }
    });

    const createPodmanMachine = vscode.commands.registerCommand('podmanStatusMonitor.createPodmanMachine', async () => {
        let machineName: any = await vscode.window.showInputBox({
            prompt: `Press Enter to use the default name: 𝗽𝗼𝗱𝗺𝗮𝗻-𝗺𝗮𝗰𝗵𝗶𝗻𝗲-𝗱𝗲𝗳𝗮𝘂𝗹𝘁`,
            placeHolder: 'Machine Name',
            ignoreFocusOut: true,
            value: 'podman-machine-default'
        });

        if (!machineName || machineName.trim() === '') {
            Logger.info('No machine name provided. Using default name: podman-machine-default');
            machineName = 'podman-machine-default';
        }
        statusBar.text = `$(loading~spin) Creating ${machineName}...`;
        // Refresh status
        await podmanManager.createPodmanMachine(machineName);
        statusBar.tooltip = await podmanManager.toolTipStatus();
        Logger.info(`Podman status refreshed by user: ${os.userInfo().username}`);
    });

    context.subscriptions.push(
        statusBar,
        autoRefreshStatus,
        refreshStatus,
        startPodman,
        stopPodman,
        deletePodmanMachine,
        rebootMachine,
        createPodmanMachine
    );

    // Initial check
    await podmanManager.toolTipStatus();
    // Recurring checks: every 10 seconds
    statusCheckInterval = setInterval(() => {
        void vscode.commands.executeCommand('podman.refreshStatus');
    }, 60000);
}

export function deactivate() {

    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
}