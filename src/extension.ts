import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as os from 'os';

let statusCheckInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('Podman Status Monitor');
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 80);
    statusBar.tooltip = 'Podman Machine Status';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Register the startPodman command
    context.subscriptions.push(
        vscode.commands.registerCommand('podmanStatusMonitor.startPodman', async () => {
            const selection = await vscode.window.showQuickPick(['Start Podman Machine', 'Cancel'], {
                placeHolder: 'What would you like to do?'
            });

            if (selection === 'Start Podman Machine') {
                const { stdout, stderr, exitCode } = await runCommand('podman machine start');
                if (exitCode === 0) {
                    vscode.window.showInformationMessage('Podman machine started successfully.', 'Close');
                    await checkPodmanStatus(); // Refresh status
                } else {
                    vscode.window.showErrorMessage(`Failed to start Podman: ${stderr}`, 'Close');
                }
            }
        })
    );

    // Register the rebootMachine command
    context.subscriptions.push(
        vscode.commands.registerCommand('podmanStatusMonitor.rebootMachine', async () => {
            const selection = await vscode.window.showQuickPick(['Reboot Machine', 'Cancel'], {
                placeHolder: 'What would you like to do?'
            });
            if (selection === 'Reboot Machine') {
                const { stdout, stderr, exitCode } = await runCommand('shutdown /r /t 5');
                if (exitCode === 0) {
                    vscode.window.showInformationMessage('Machine will reboot in 5 seconds.', 'Close');
                } else {
                    vscode.window.showErrorMessage(`Failed to reboot machine: ${stderr}`, 'Close');
                }
            }
        })
    );

    function runCommand(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
        return new Promise((resolve) => {
            const child = exec(
                cmd,
                { shell: os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash' },
                (error: any, stdout: any, stderr: any) => {
                    resolve({ stdout, stderr, exitCode: error?.code ?? 0 });
                }
            )
        });
    }

    async function isPodmanRunning(): Promise<{ running: boolean, exitCode: number | null }> {
        const { stdout, stderr, exitCode } = await runCommand('podman machine list --format "{{.Running}}"');

        // await vscode.window.showInformationMessage(`${stderr}`);
        if (exitCode != 0) {
            return { running: false, exitCode };
        }

        if (stdout.trim() === 'true') {
            return { running: true, exitCode };
        }
        return { running: false, exitCode };
    }

    async function checkPodmanStatus() {
        const { running, exitCode } = await isPodmanRunning();

        if (exitCode != 0) {
            statusBar.text = '$(error) Podman: Error';
            statusBar.color = 'pink';
            const selection = await vscode.window.showErrorMessage('Error checking Podman status. Please ensure Podman is installed. If Podman is installed, then click to reboot the machine.', 'Reboot Machine', 'Close');
            if (selection === 'Reboot Machine') {
                await vscode.commands.executeCommand('podmanStatusMonitor.rebootMachine');
            }
            // If user clicks on the status bar, we could prompt at the top pallete to select the option to reboot podman machine
            statusBar.command = 'podmanStatusMonitor.rebootMachine';
            stopStatusCheck();
        }
        else {
            if (running) {
                statusBar.text = '$(remote) Podman: Running';
                statusBar.color = 'green';
                startStatusCheck();
                statusBar.command = undefined; // Clear any previous command
            } else {
                statusBar.text = '$(warning) Podman: Stopped';
                statusBar.color = 'red';
                const selection = await vscode.window.showWarningMessage('Podman machine is not running. Click the status bar to start it.', 'Start Podman', 'Close');
                if (selection === 'Start Podman') {
                    await vscode.commands.executeCommand('podmanStatusMonitor.startPodman');
                }
                // If user clicks on the status bar, we could prompt at the top pallete to select the option to start podman
                statusBar.command = 'podmanStatusMonitor.startPodman';
                stopStatusCheck();
            }
        }
    }

    function startStatusCheck() {
        if (!statusCheckInterval) {
            statusCheckInterval = setInterval(async () => {
                await checkPodmanStatus();
            }, 10000);
        }
    }

    function stopStatusCheck() {
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = undefined;
        }
    }

    // Initial check
    checkPodmanStatus();
}

export function deactivate() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
}