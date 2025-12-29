import * as vscode from 'vscode';
import * as os from 'node:os';
import PodmanManager from './classes/podman-manager';
import Logger from './classes/logger';

let statusCheckInterval: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext) {
    Logger.info('Activating Podman Status Monitor extension');
    const podmanManager = new PodmanManager(); // Create instance of PodmanManager
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 80);
    statusBar.text = '$(rocket) Podman';
    statusBar.tooltip = await podmanManager.toolTipStatus();
    statusBar.command = 'podman.refreshStatus';
    statusBar.show();
    context.subscriptions.push(statusBar,
        vscode.commands.registerCommand('podman.refreshStatus', async () => {
            await podmanManager.checkPodmanStatus(statusBar);
            vscode.window.showInformationMessage('Podman status refreshed');
            statusBar.tooltip = await podmanManager.toolTipStatus();
            Logger.info(`Podman status refreshed by user: ${os.userInfo().username}`);
        }),
        vscode.commands.registerCommand('podmanStatusMonitor.startPodman', async (stoppedMachines?: string[] | null) => {
            let machineList: string[] = [];

            // If no machines provided, get list of stopped machines
            if (!stoppedMachines || stoppedMachines.length === 0) {
                const { stdout: machineListOutput } = await podmanManager.runCommand('podman machine list --format json');

                try {
                    const parsed = JSON.parse(machineListOutput);
                    machineList = parsed.filter((m: any) => !m.Running).map((m: any) => m.Name);

                    if (machineList.length === 0) {
                        vscode.window.showInformationMessage('All Podman machines are already running.');
                        return;
                    }
                } catch (error) {
                    vscode.window.showErrorMessage('Failed to get Podman machine list.');
                    Logger.error(`Failed to parse machine list: ${error}`);
                    return;
                }
            } else {
                machineList = stoppedMachines;
            }

            // Ensure we have a valid array before showing quick pick
            if (machineList.length === 0) {
                vscode.window.showInformationMessage('No stopped Podman machines found.');
                return;
            }

            // Let user select which machines to start (multi-select)
            const selectedMachines = await vscode.window.showQuickPick(machineList, {
                placeHolder: 'Select Podman machine(s) to start',
                canPickMany: true,
                ignoreFocusOut: true
            });

            if (!selectedMachines || selectedMachines.length === 0) {
                return; // User cancelled or selected nothing
            }

            // Start selected machines
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Starting ${selectedMachines.length} Podman Machine(s)`,
                    cancellable: false
                },
                async (progress) => {
                    const totalMachines = selectedMachines.length;
                    let completedMachines = 0;
                    const results: { machine: string; success: boolean; error?: string }[] = [];

                    for (const machineName of selectedMachines) {
                        progress.report({
                            increment: 0,
                            message: `Starting ${machineName} (${completedMachines + 1}/${totalMachines})...`
                        });

                        const { stdout, stderr, exitCode } = await podmanManager.runCommand(`podman machine start ${machineName}`);
                        Logger.info(`Podman start command for ${machineName} - stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

                        if (exitCode === 0) {
                            results.push({ machine: machineName, success: true });
                            Logger.info(`Podman machine '${machineName}' started successfully.`);
                        } else {
                            results.push({ machine: machineName, success: false, error: stderr });
                            Logger.error(`Failed to start Podman machine '${machineName}': ${stderr}`);
                        }

                        completedMachines++;
                        progress.report({
                            increment: (100 / totalMachines),
                            message: `Completed ${completedMachines}/${totalMachines}`
                        });
                    }

                    // Show results summary
                    const successful = results.filter(r => r.success);
                    const failed = results.filter(r => !r.success);

                    if (failed.length === 0) {
                        vscode.window.showInformationMessage(
                            `Successfully started ${successful.length} machine(s): ${successful.map(r => r.machine).join(', ')}`,
                            'Close'
                        );
                    } else if (successful.length === 0) {
                        vscode.window.showErrorMessage(
                            `Failed to start all machines. Check output for details.`,
                            'Close'
                        );
                    } else {
                        vscode.window.showWarningMessage(
                            `Started ${successful.length} machine(s). Failed: ${failed.map(r => r.machine).join(', ')}`,
                            'Close'
                        );
                    }

                    // Refresh status
                    await podmanManager.checkPodmanStatus(statusBar);
                }
            );
        }),
        vscode.commands.registerCommand('podmanStatusMonitor.rebootMachine', async () => {
            const selection = await vscode.window.showQuickPick(['Reboot Machine', 'Cancel'], {
                placeHolder: 'What would you like to do?'
            });

            if (selection === 'Reboot Machine') {
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
        })
    );

    // Initial check
    podmanManager.checkPodmanStatus(statusBar);
}

export function deactivate() {

    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
}