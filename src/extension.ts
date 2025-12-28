import * as vscode from 'vscode';
import { exec } from 'node:child_process';
import * as os from 'node:os';
import Logger from './classes/logger';

let statusCheckInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    Logger.info('Activating Podman Status Monitor extension');
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 80);
    statusBar.text = '$(rocket) Podman';
    statusBar.tooltip = 'Podman Machine Status';
    statusBar.command = 'podman.refreshStatus';
    statusBar.show();
    context.subscriptions.push(statusBar,
        vscode.commands.registerCommand('podman.refreshStatus', async () => {
            await checkPodmanStatus();
            vscode.window.showInformationMessage('Podman status refreshed');
            Logger.info('Podman status refreshed by user');
        })
        ,
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

                        const { stdout, stderr, exitCode } = await runCommand('podman machine start ${machineName}');
                        Logger.info(`Podman start command stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

                        progress.report({ increment: 50, message: 'Starting machine...' });

                        if (exitCode === 0) {
                            progress.report({ increment: 100, message: 'Verifying status...' });
                            await checkPodmanStatus(); // Refresh status
                            vscode.window.showInformationMessage('Podman machine started successfully.', 'Close');
                            Logger.info('Podman machine started successfully.');
                        } else {
                            vscode.window.showErrorMessage(`Failed to start Podman: ${stderr}`, 'Close');
                            Logger.error(`Failed to start Podman machine: ${stderr}`);
                        }
                    }
                );
            }
        })
        ,
        vscode.commands.registerCommand('podmanStatusMonitor.rebootMachine', async () => {
            const selection = await vscode.window.showQuickPick(['Reboot Machine', 'Cancel'], {
                placeHolder: 'What would you like to do?'
            });

            if (selection === 'Reboot Machine') {
                const command: string = os.platform() === 'win32' ? 'shutdown /r /t 5' : 'sudo reboot';
                const { stdout, stderr, exitCode } = await runCommand(command);
                Logger.info(`Reboot command stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

                if (exitCode === 0) {
                    vscode.window.showInformationMessage('Machine will reboot in 5 seconds.', 'Close');
                    Logger.info('Machine reboot initiated successfully.');
                } else {
                    vscode.window.showErrorMessage(`Failed to reboot machine: ${stderr}`, 'Close');
                    Logger.error(`Failed to reboot machine: ${stderr}`);
                }
            }
        })
    );

    async function checkPodmanStatus() {
        Logger.info(`Host machine OS: ${os.platform()}`);
        const cmd: string = 'podman machine list --format "{{json .}}" | ConvertFrom-Json | Select-Object Name, Running | ConvertTo-Json'
        const { stdout, stderr, exitCode } = await runCommand(cmd);
        statusBar.command = 'podman.refreshStatus'; // Reset command to manual refresh

        Logger.info(`Podman status check stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);
        // stdout is expected to be a JSON array of objects with Name and Running properties
        const machines = JSON.parse(stdout || '[]');
        Logger.info(`Parsed Podman machine names: ${machines.map((m: any) => m.Name)}`);

        if (stderr?.includes('command not found') || stderr?.includes('is not recognized')) {
            statusBar.text = '$(error) Podman: Not Installed';
            statusBar.color = 'purple';
            Logger.error('Podman is not installed on this system.');
            const selection = await vscode.window.showErrorMessage('Podman is not installed. Please visit official Podman page for installation instructions.', 'Visit Website', 'Close');

            if (selection === 'Visit Website') {
                vscode.env.openExternal(vscode.Uri.parse('https://podman.io/docs/installation'));
            }
            return;
        }

        if (exitCode === 0) {
            if (os.platform() === 'linux') {
                statusBar.text = '$(rocket) Podman: Installed';
                statusBar.color = 'green';
                statusBar.tooltip = 'Podman on Linux runs containers using host kernel namespaces/cgroups, no VM required.';
                Logger.info('Podman on Linux detected, no machine status needed.');
            } else {
                const totalMachineCounts = machines.length;
                const runningMachineCounts = machines.filter((m: any) => m.Running).length;

                if (runningMachineCounts === totalMachineCounts) {
                    Logger.info('All Podman machines are running.');
                    statusBar.text = `$(rocket) Podman: Running (${runningMachineCounts}/${totalMachineCounts}) machine(s)`;
                    statusBar.color = 'green';
                    // when clicked the podman running status bar, It will popup a message to start the stopped machines
                } else if (runningMachineCounts < totalMachineCounts && runningMachineCounts > 0) {
                    Logger.warn('Some Podman machines are not running.');
                    statusBar.text = `$(circle-slash) Podman: Stopped (${runningMachineCounts}/${totalMachineCounts}) machine(s)`;
                    statusBar.color = 'orange';

                    const stoppedMachines: string[] = machines.filter((m: any) => !m.Running).map((m: any) => m.Name);
                    statusBar.command = 'podmanStatusMonitor.startMachine';

                    const selection = await vscode.window.showWarningMessage('Some Podman machines are not running. Would you like to start them?', 'Start Machines', 'Close');
                    if (selection === 'Start Machines') {
                        await vscode.commands.executeCommand('podmanStatusMonitor.startPodman', stoppedMachines);
                    }
                } else {
                    Logger.error('No Podman machines are running.');
                    statusBar.text = `$(circle-slash) Podman: Stopped (${runningMachineCounts}/${totalMachineCounts}) machine(s)`;
                    statusBar.color = 'red';

                    const stoppedMachines: string[] = machines.filter((m: any) => !m.Running).map((m: any) => m.Name);
                    statusBar.command = 'podmanStatusMonitor.startMachine';

                    const selection = await vscode.window.showWarningMessage('Some Podman machines are not running. Would you like to start them?', 'Start Machines', 'Close');
                    if (selection === 'Start Machines') {
                        await vscode.commands.executeCommand('podmanStatusMonitor.startPodman', stoppedMachines);
                    }
                }
            }
        }
        else {
            statusBar.text = '$(error) Podman: Error';
            statusBar.color = 'purple';
            // If user clicks on the status bar, we could prompt at the top pallete to select the option to reboot podman machine
            Logger.error(`Error checking Podman status: ${stderr}`);
            statusBar.command = 'podmanStatusMonitor.rebootMachine';
            const selection = await vscode.window.showErrorMessage('Error checking Podman status. Please ensure Podman is installed. If Podman is installed, then click to reboot the machine.', 'Reboot Machine', 'Close');

            if (selection === 'Reboot Machine') {
                await vscode.commands.executeCommand('podmanStatusMonitor.rebootMachine');
            }
        }
    }

    // Initial check
    checkPodmanStatus();
}


function runCommand(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
        exec(
            cmd,
            { shell: os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash' },
            (error: any, stdout: any, stderr: any) => {
                resolve({ stdout, stderr, exitCode: error?.code ?? 0 });
            }
        )
    });
}

export function deactivate() {

    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
}