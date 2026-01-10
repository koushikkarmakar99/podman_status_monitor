import * as vscode from 'vscode';
import Logger from './logger';
import { exec } from 'node:child_process';
import * as os from 'node:os';

class PodmanManager {
    // Method to check Podman status and update status bar
    async checkPodmanStatus(statusBar: vscode.StatusBarItem) {
        Logger.info(`Host machine OS: ${os.platform()}`);
        const cmd: string = 'podman machine list --format "{{json .}}"';
        Logger.info(`Executing command: [${cmd}]...`);
        const { stdout, stderr, exitCode } = await this.runCommand(cmd);
        Logger.info(`Podman status check stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

        if (stderr?.includes('command not found') || stderr?.includes('is not recognized')) {
            this.setStatus(statusBar, '⛔ Podman: Not Installed', 'white', 'black');
            Logger.error('Podman is not installed on this system.');
            const selection = await vscode.window.showErrorMessage('Podman is not installed. Please visit official Podman page for installation instructions.', 'Visit Website', 'Close');

            if (selection === 'Visit Website') {
                vscode.env.openExternal(vscode.Uri.parse('https://podman.io/docs/installation'));
            }
            return;
        }

        if (exitCode === 0) {
            if (os.platform() === 'linux') {
                this.setStatus(statusBar, '🚀 Podman: Installed', 'white', 'black');
                statusBar.tooltip = 'Podman on Linux runs containers using host kernel namespaces/cgroups, no VM required.';
                Logger.info('Podman on Linux detected, no machine status needed.');
            } else {
                const { machines, runningMachines, stoppedMachines } = this.getMachines(stdout);
                const totalMachineCounts = machines.length;
                const runningMachineCounts = runningMachines.length;
                const stoppedMachineCounts = stoppedMachines.length;

                if (totalMachineCounts === 0) {
                    this.setStatus(statusBar, '⛔ Podman: No Machines', 'white', 'black');
                    Logger.warn('No Podman machines found. Please create a Podman machine to run containers.');
                    const selection = await vscode.window.showWarningMessage('No Podman machines found. Would you like to create one now?', 'Create Machine', 'Close');

                    if (selection === 'Create Machine') {
                        await vscode.commands.executeCommand('podmanStatusMonitor.createPodmanMachine');
                    } else {
                        await vscode.window.showInformationMessage('You can create a Podman machine later by running "podman machine init" in your terminal.');
                    }
                } else if (runningMachineCounts === totalMachineCounts) {
                    Logger.info(`All Podman machine(s) are running. Machine names: ${runningMachines}`);
                    this.setStatus(statusBar, `🟢 Podman: Running (${runningMachineCounts}/${totalMachineCounts}) machine(s)`, 'white', 'black');
                    // when clicked the podman running status bar, It will popup a message to start the stopped machines
                } else if (runningMachineCounts < totalMachineCounts && runningMachineCounts > 0) {
                    Logger.info(`${runningMachineCounts} Podman machine(s) are running. Machine names: ${runningMachines}`);
                    Logger.warn(`${stoppedMachineCounts} Podman machine(s) are not running. Machine names: ${stoppedMachines}`);
                    this.setStatus(statusBar, `🟠 Podman: Stopped (${stoppedMachineCounts}/${totalMachineCounts}) machine(s)`, 'white', 'black');
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
                    this.setStatus(statusBar, `🟥 Podman: Stopped (${stoppedMachineCounts}/${totalMachineCounts}) machine(s)`, 'white', 'black');
                    const selection = await vscode.window.showWarningMessage('All Podman machines are stopped. Would you like to start them?', 'Start Machines', 'Close');

                    if (selection === 'Start Machines') {
                        await vscode.commands.executeCommand('podmanStatusMonitor.startPodman', stoppedMachines);
                    }
                }
            }
        }
        else {
            this.setStatus(statusBar, '⛔ Podman: Error', 'white', 'black');
            // If user clicks on the status bar, we could prompt at the top pallete to select the option to reboot podman machine
            Logger.error(`Error checking Podman status: ${stderr}`);
            statusBar.command = 'podmanStatusMonitor.rebootMachine';
            const selection = await vscode.window.showErrorMessage('Error checking Podman status. Please ensure Podman is installed. If Podman is installed, then click to reboot the machine.', 'Reboot Machine', 'Close');

            if (selection === 'Reboot Machine') {
                await vscode.commands.executeCommand('podmanStatusMonitor.rebootMachine');
            }
        }
    }

    setStatus(statusBar: vscode.StatusBarItem, text: string, whiteThemeColor: string, darkThemeColor: string) {
        statusBar.text = text;
        if (vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark || vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast) {
            statusBar.color = whiteThemeColor; // White for dark themes
        } else {
            statusBar.color = darkThemeColor; // Black for light themes
        }
    }

    getMachines(stdout: string): { machines: string[], runningMachines: string[], stoppedMachines: string[] } {
        const trimmed = stdout ? stdout.trim() : '';
        if (!trimmed) {
            Logger.info('No Podman machines parsed (empty output).');
            return { machines: [], runningMachines: [], stoppedMachines: [] };
        }
        const machines = trimmed
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
        Logger.info(`Parsed Podman machine names: ${machines.map((m: any) => m.Name)}`);
        const runningMachines: string[] = machines
            .filter((m: any) => m.Running)
            .map((m: any) => m.Name.replace(/\*$/, ''));
        const stoppedMachines: string[] = machines
            .filter((m: any) => !m.Running)
            .map((m: any) => m.Name.replace(/\*$/, ''));
        const machineNames: string[] = machines.map((m: any) => m.Name.replace(/\*$/, ''));
        return { machines: machineNames, runningMachines, stoppedMachines };
    }

    // Helper method to run shell commands
    async runCommand(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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

        const cmd: string = 'podman machine list --format "{{json .}}"';
        const { stdout, stderr, exitCode } = await this.runCommand(cmd);

        if (stderr?.includes('command not found') || stderr?.includes('is not recognized')) {
            return '⛔ Podman is not installed on this system.';
        } else if (os.platform() === 'linux') {
            return '🐧 Podman on Linux runs containers using host kernel namespaces/cgroups, no VM required.';
        } else if (exitCode !== 0 || !stdout) {
            return '⚠️ Podman machine not setup';
        }

        try {
            const machines = stdout
                .trim()
                .split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));

            if (machines.length === 0) {
                return 'No Podman machines found';
            }

            const rows = machines.map((m: any) => {
                const status = m.Running ? '🟢 Running' : '🟥 Stopped';
                return `  ${status}  ${m.Name}`;
            });

            return rows.join('\n');

        } catch (error) {
            return `Error parsing machine list: ${error}`;
        }
    }
}

export default PodmanManager;