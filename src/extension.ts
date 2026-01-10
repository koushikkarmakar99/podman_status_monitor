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
    context.subscriptions.push(
        statusBar,
        vscode.commands.registerCommand('podman.autoRefreshStatus', async () => {
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
        }),
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
                const cmd: string = 'podman machine list --format json';
                Logger.info(`Executing command to get stopped machines: [${cmd}]...`);
                const { stdout: machineListOutput } = await podmanManager.runCommand(cmd);

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
                    cancellable: true
                },
                async (progress, token) => {
                    token.onCancellationRequested(() => {
                        Logger.info('User cancelled Podman machine start operation.');
                    });
                    const totalMachines = selectedMachines.length;
                    let completedMachines = 0;
                    const results: { machine: string; success: boolean; error?: string }[] = [];

                    for (const machineName of selectedMachines) {
                        progress.report({
                            increment: 0,
                            message: `Starting ${machineName} (${completedMachines + 1}/${totalMachines})...`
                        });

                        const cmd: string = `podman machine start ${machineName}`;
                        Logger.info(`Executing command: [${cmd}]...`);
                        const { stdout, stderr, exitCode } = await podmanManager.runCommand(cmd);
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
                    statusBar.tooltip = await podmanManager.toolTipStatus();
                    Logger.info(`Podman status refreshed by user: ${os.userInfo().username}`);
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
        }),
        vscode.commands.registerCommand('podmanStatusMonitor.createPodmanMachine', async () => {
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

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating Podman Machine: ${machineName}`,
                    cancellable: true
                },
                async (progress, token) => {
                    token.onCancellationRequested(() => {
                        Logger.info('User cancelled Podman machine creation operation.');
                    });
                    progress.report({ increment: 0, message: `Initializing machine ${machineName}...` });
                    let retryCount = 0; // In case we need to retry WSL unregister
                    const maxRetries = 1;

                    while (retryCount <= maxRetries) {
                        // Create and start the podman machine
                        const cmd: string = `podman machine init --now ${machineName}`;
                        Logger.info(`Executing command: [${cmd}]...`);
                        const { stdout, stderr, exitCode } = await podmanManager.runCommand(cmd);
                        Logger.info(`Podman machine init command for ${machineName} - stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

                        progress.report({ increment: 50, message: `Finalizing machine ${machineName}...` });

                        if (exitCode === 0) {
                            vscode.window.showInformationMessage(`Podman machine '${machineName}' created successfully.`, 'Close');
                            Logger.info(`Podman machine '${machineName}' created successfully.`);
                            progress.report({ increment: 100, message: `${machineName} created` });
                            vscode.window.showInformationMessage(`Podman machine '${machineName}' created successfully.`, 'Close');
                            retryCount = maxRetries + 1; // Exit loop
                        } else {
                            vscode.window.showErrorMessage(`Failed to create Podman machine '${machineName}': ${stderr}`, 'Close');
                            Logger.error(`Failed to create Podman machine '${machineName}': ${stderr}`);
                            progress.report({ increment: 100, message: `Failed to create ${machineName}` });
                            const errorMessage = `Error: vm "${machineName}" already exists on hypervisor`;

                            if (stderr.includes(errorMessage)) {
                                Logger.warn(`podman machine creation failed due to to WSL conflict for machine '${machineName}'. Trying to unregister the WSL distro and re-try podman machine creation.`);
                                retryCount++;
                                vscode.window.showWarningMessage(`Attempting to unregister WSL distro for machine '${machineName}' (Attempt ${retryCount} of ${maxRetries})`, 'Close');
                                const cmd: string = `wsl --unregister ${machineName}`;
                                Logger.info(`Executing command: [${cmd}]...`);
                                const { stdout, stderr, exitCode } = await podmanManager.runCommand(cmd);
                                Logger.info(`WSL unregister command for ${machineName} - stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

                                if (exitCode === 0) {
                                    vscode.window.showInformationMessage(`Successfully unregistered WSL distro for machine '${machineName}'. Retrying Podman machine creation.`, 'Close');
                                    Logger.info(`Successfully unregistered WSL distro for machine '${machineName}'. Retrying Podman machine creation.`);
                                } else {
                                    vscode.window.showErrorMessage(`Failed to unregister WSL distro for machine '${machineName}. Please fix the issue and retry': ${stderr}`, 'Close');
                                    Logger.error(`Failed to unregister WSL distro for machine '${machineName}': ${stderr}`);
                                    retryCount = maxRetries + 1; // Exit loop
                                }
                            }
                        }
                    }
                }
            );
            // Refresh status
            await podmanManager.checkPodmanStatus(statusBar);
            statusBar.tooltip = await podmanManager.toolTipStatus();
            Logger.info(`Podman status refreshed by user: ${os.userInfo().username}`);
        })
    );

    // Initial check
    await podmanManager.checkPodmanStatus(statusBar);
    // Recurring checks: every 10 seconds
    statusCheckInterval = setInterval(() => {
        void vscode.commands.executeCommand('podman.autoRefreshStatus');
    }, 10000);
}

export function deactivate() {

    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
}