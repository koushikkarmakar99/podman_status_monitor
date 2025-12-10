import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as os from 'os';

let statusCheckInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 80);
    statusBar.text = '$(rocket) Podman';
    statusBar.tooltip = 'Podman Machine Status';
    statusBar.command = 'podman.refreshStatus';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Register manual refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('podman.refreshStatus', async () => {
            await checkPodmanStatus();
            vscode.window.showInformationMessage('Podman status refreshed');
        })
    );

    // Register the startPodman command
    context.subscriptions.push(
        vscode.commands.registerCommand('podmanStatusMonitor.startPodman', async () => {
            const selection = await vscode.window.showQuickPick(['Start Podman Machine', 'Cancel'], {
                placeHolder: 'What would you like to do?'
            });

            if (selection === 'Start Podman Machine') {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Starting Podman Machine',
                        cancellable: false
                    },
                    async (progress) => {
                        progress.report({ increment: 0, message: 'Initializing...' });

                        const { stdout, stderr, exitCode } = await runCommand('podman machine start');
                        console.log(`Podman start command stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

                        progress.report({ increment: 50, message: 'Starting machine...' });

                        if (exitCode === 0) {
                            progress.report({ increment: 100, message: 'Verifying status...' });
                            await checkPodmanStatus(); // Refresh status
                            vscode.window.showInformationMessage('Podman machine started successfully.', 'Close');
                        } else {
                            vscode.window.showErrorMessage(`Failed to start Podman: ${stderr}`, 'Close');
                        }
                    }
                );
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
                const command: string = os.platform() === 'win32' ? 'shutdown /r /t 5' : 'sudo reboot';
                const { stdout, stderr, exitCode } = await runCommand(command);
                console.log(`Reboot command stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

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

    async function isPodmanRunning(): Promise<{ running: boolean; exitCode: number | null; stderr: string | null }> {
        const { stdout, stderr, exitCode } = await runCommand('podman machine list --format "{{.Running}}"');
        console.log(`Podman status check stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

        if (exitCode != 0) {
            return { running: false, exitCode, stderr };
        }

        if (stdout.trim() === 'true') {
            return { running: true, exitCode, stderr: null };
        }
        return { running: false, exitCode, stderr: null };
    }

    async function checkPodmanStatus() {
        console.log('Host machine OS:', os.platform());
        const { running, exitCode, stderr } = await isPodmanRunning();

        if (stderr?.includes('command not found') || stderr?.includes('is not recognized')) {
            statusBar.text = '$(error) Podman: Not Installed';
            statusBar.color = 'purple';
            // stopStatusCheck();
            const selection = await vscode.window.showErrorMessage('Podman is not installed. Please visit official Podman page for installation instructions.', 'Visit Website', 'Close');

            if (selection === 'Visit Website') {
                vscode.env.openExternal(vscode.Uri.parse('https://podman.io/docs/installation'));
            }
            return;
        }

        if (exitCode != 0) {
            statusBar.text = '$(error) Podman: Error';
            statusBar.color = 'purple';
            // If user clicks on the status bar, we could prompt at the top pallete to select the option to reboot podman machine
            statusBar.command = 'podmanStatusMonitor.rebootMachine';
            const selection = await vscode.window.showErrorMessage('Error checking Podman status. Please ensure Podman is installed. If Podman is installed, then click to reboot the machine.', 'Reboot Machine', 'Close');

            if (selection === 'Reboot Machine') {
                await vscode.commands.executeCommand('podmanStatusMonitor.rebootMachine');
            }
        }
        else {
            if (running) {
                statusBar.text = '$(rocket) Podman: Running';
                statusBar.color = 'green';
                statusBar.command = undefined; // Clear any previous command
            } else {

                // In Linux we don't need podman to create a machine to run containers as it uses the native Linux kernel
                if (os.platform() === 'linux') {
                    statusBar.text = '$(rocket) Podman: Installed';
                    statusBar.color = 'green';
                    statusBar.tooltip = 'Podman on Linux runs containers using host kernel namespaces/cgroups, no VM required.';
                } else {
                    statusBar.text = '$(circle-slash) Podman: Stopped';
                    statusBar.color = 'red';
                    // If user clicks on the status bar, we could prompt at the top pallete to select the option to start podman
                    statusBar.command = 'podmanStatusMonitor.startPodman';
                    const selection = await vscode.window.showWarningMessage('Podman machine is not running. Click the status bar to start it.', 'Start Podman', 'Close');

                    if (selection === 'Start Podman') {
                        await vscode.commands.executeCommand('podmanStatusMonitor.startPodman');
                    }
                }
            }
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