import * as vscode from 'vscode';
import Logger from './logger';
import { exec } from 'node:child_process';
import * as os from 'node:os';

class PodmanManager {
    // Method to check Podman status and update status bar
    async checkPodmanStatus(statusBar: vscode.StatusBarItem) {
        Logger.info(`Host machine OS: ${os.platform()}`);
        const cmd: string = 'podman machine list --format "{{json .}}" | ConvertFrom-Json | Select-Object Name, Running | ConvertTo-Json'
        const { stdout, stderr, exitCode } = await this.runCommand(cmd);
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
                const runningMachines: string[] = machines
                    .filter((m: any) => m.Running)
                    .map((m: any) => m.Name.replace(/\*$/, ''));
                const runningMachineCounts = runningMachines.length;
                const stoppedMachines: string[] = machines
                    .filter((m: any) => !m.Running)
                    .map((m: any) => m.Name.replace(/\*$/, ''));
                statusBar.command = 'podman.refreshStatus';
                const stoppedMachineCounts = stoppedMachines.length;

                if (runningMachineCounts === totalMachineCounts) {
                    Logger.info(`All Podman machine(s) are running. Machine names: ${runningMachines}`);
                    statusBar.text = `$(debug-start) Podman: Running (${runningMachineCounts}/${totalMachineCounts}) machine(s)`;
                    statusBar.color = 'green';
                    // when clicked the podman running status bar, It will popup a message to start the stopped machines
                } else if (runningMachineCounts < totalMachineCounts && runningMachineCounts > 0) {
                    Logger.info(`${runningMachineCounts} Podman machine(s) are running. Machine names: ${runningMachines}`);
                    Logger.warn(`${stoppedMachineCounts} Podman machine(s) are not running. Machine names: ${stoppedMachines}`);
                    statusBar.text = `$(debug-stop) Podman: Stopped (${stoppedMachineCounts}/${totalMachineCounts}) machine(s)`;
                    statusBar.color = 'orange';
                    const selection = await vscode.window.showWarningMessage(
                        `${stoppedMachineCounts} Podman machine(s) stopped: ${stoppedMachines.join(', ')}. Would you like to start them?`,
                        'Start Machines',
                        'Close'
                    );

                    if (selection === 'Start Machines') {
                        await vscode.commands.executeCommand('podmanStatusMonitor.startPodman', stoppedMachines);
                    }
                } else {
                    Logger.error(`No Podman machine(s) are running. Machine names: ${stoppedMachines}`);
                    statusBar.text = `$(debug-stop) Podman: Stopped (${stoppedMachineCounts}/${totalMachineCounts}) machine(s)`;
                    statusBar.color = 'red';
                    const selection = await vscode.window.showWarningMessage('All Podman machines are stopped. Would you like to start them?', 'Start Machines', 'Close');

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

    // Helper method to run shell commands
    runCommand(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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

    // Method to get tooltip status
    // Example tooltip:
    // Podman Machines:
    // ▶ Running podman-machine1
    // ⏹ Stopped podman-machine2
    // ▶ Running podman-machine3
    async toolTipStatus(): Promise<string> {
        const cmd: string = 'podman machine list --format "{{json .}}" | ConvertFrom-Json | Select-Object Name, Running | ConvertTo-Json';
        const { stdout, exitCode } = await this.runCommand(cmd);

        if (exitCode !== 0 || !stdout) {
            return 'Failed to get machine status';
        }

        try {
            const machines = JSON.parse(stdout || '[]');

            if (machines.length === 0) {
                return 'No Podman machines found';
            }

            const rows = machines.map((m: any) => {
                const status = m.Running ? '▶ Running' : '⏹ Stopped';
                return `  ${status}  ${m.Name}`;
            });

            return rows.join('\n');

        } catch (error) {
            return `Error parsing machine list: ${error}`;
        }
    }
}

export default PodmanManager;