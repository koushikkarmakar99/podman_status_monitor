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
                } else if (runningMachineCounts === totalMachineCounts) {
                    Logger.info(`All Podman machine(s) are running. Machine names: ${runningMachines}`);
                    this.setStatus(statusBar, `🟢 Podman: Running (${runningMachineCounts}/${totalMachineCounts}) machine(s)`, 'white', 'black');
                    // when clicked the podman running status bar, It will popup a message to start the stopped machines
                } else if (runningMachineCounts < totalMachineCounts && runningMachineCounts > 0) {
                    Logger.info(`${runningMachineCounts} Podman machine(s) are running. Machine names: ${runningMachines}`);
                    Logger.warn(`${stoppedMachineCounts} Podman machine(s) are not running. Machine names: ${stoppedMachines}`);
                    this.setStatus(statusBar, `🟠 Podman: Stopped (${stoppedMachineCounts}/${totalMachineCounts}) machine(s)`, 'white', 'black');
                } else {
                    Logger.error(`No Podman machine(s) are running. Machine names: ${stoppedMachines}`);
                    this.setStatus(statusBar, `🟥 Podman: Stopped (${stoppedMachineCounts}/${totalMachineCounts}) machine(s)`, 'white', 'black');
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

    async startPodmanMachine(machineName: string): Promise<void> {
        if (!machineName || machineName.trim() === '') {
            machineName = 'podman-machine-default';
        }
        const cmd: string = `podman machine start ${machineName}`;
        const { stdout, stderr, exitCode } = await this.runCommand(cmd);
        if (exitCode === 0) {
            Logger.info(`Podman machine "${machineName}" started successfully. Output: ${stdout}`);
        } else {
            vscode.window.showErrorMessage(`Failed to start Podman machine "${machineName}". Error: ${stderr}`);
            Logger.error(`Failed to start Podman machine "${machineName}". Error: ${stderr}`);
        }
    }

    async stopPodmanMachine(machineName: string): Promise<void> {
        if (!machineName || machineName.trim() === '') {
            machineName = 'podman-machine-default';
        }
        const cmd: string = `podman machine stop ${machineName}`;
        const { stdout, stderr, exitCode } = await this.runCommand(cmd);
        if (exitCode === 0) {
            Logger.info(`Podman machine "${machineName}" stopped successfully. Output: ${stdout}`);
        } else {
            vscode.window.showErrorMessage(`Failed to stop Podman machine "${machineName}". Error: ${stderr}`);
            Logger.error(`Failed to stop Podman machine "${machineName}". Error: ${stderr}`);
        }
    }

    async createPodmanMachine(machineName: string): Promise<void> {
        if (!machineName || machineName.trim() === '') {
            machineName = 'podman-machine-default';
        }

        // Check if machine already exists before trying to create. if yes show a error popup
        const checkCmd: string = `podman machine list --format "{{json .}}"`;
        const { stdout } = await this.runCommand(checkCmd);
        const { machines } = this.getMachines(stdout);
        if (machines.includes(machineName)) {
            vscode.window.showErrorMessage(`Podman machine '${machineName}' already exists.`, 'Close');
            Logger.error(`Podman machine '${machineName}' already exists.`);
            return;
        }


        let retryCount = 0; // In case we need to retry WSL unregister
        const maxRetries = 1;

        while (retryCount <= maxRetries) {
            // Create and start the podman machine
            const cmd: string = `podman machine init --now ${machineName}`;
            Logger.info(`Executing command: [${cmd}]...`);
            const { stdout, stderr, exitCode } = await this.runCommand(cmd);
            Logger.info(`Podman machine init command for ${machineName} - stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

            if (exitCode === 0) {
                Logger.info(`Podman machine '${machineName}' created successfully.`);
                retryCount = maxRetries + 1; // Exit loop
            } else {
                vscode.window.showErrorMessage(`Failed to create Podman machine '${machineName}': ${stderr}`, 'Close');
                Logger.error(`Failed to create Podman machine '${machineName}': ${stderr}`);
                const errorMessage = `Error: vm "${machineName}" already exists on hypervisor`;

                if (stderr.includes(errorMessage)) {
                    Logger.warn(`podman machine creation failed due to to WSL conflict for machine '${machineName}'. Trying to unregister the WSL distro and re-try podman machine creation.`);
                    retryCount++;
                    vscode.window.showWarningMessage(`Attempting to unregister WSL distro for machine '${machineName}' (Attempt ${retryCount} of ${maxRetries})`, 'Close');
                    const cmd: string = `wsl --unregister ${machineName}`;
                    Logger.info(`Executing command: [${cmd}]...`);
                    const { stdout, stderr, exitCode } = await this.runCommand(cmd);
                    Logger.info(`WSL unregister command for ${machineName} - stdout: ${stdout}, stderr: ${stderr}, exitCode: ${exitCode}`);

                    if (exitCode === 0) {
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

    async deletePodmanMachine(machineName: string): Promise<void> {
        if (!machineName || machineName.trim() === '') {
            machineName = 'podman-machine-default';
        }
        const cmd = `podman machine rm ${machineName} -f`;
        const { stdout, stderr, exitCode } = await this.runCommand(cmd);
        if (exitCode === 0) {
             Logger.info(`Podman machine "${machineName}" deleted successfully. Output: ${stdout}`);
        } else {
            vscode.window.showErrorMessage(`Failed to delete Podman machine "${machineName}". Error: ${stderr}`);
            Logger.error(`Failed to delete Podman machine "${machineName}". Error: ${stderr}`);
        }
    }

    // Method to get tooltip status
    // Example tooltip:
    // Podman Machines:
    // ▶ Running podman-machine1
    // ⏹ Stopped podman-machine2
    // ▶ Running podman-machine3
    async toolTipStatus(): Promise<vscode.MarkdownString> {
        const cmd: string = 'podman machine list --format "{{json .}}"';
        const { stdout, stderr, exitCode } = await this.runCommand(cmd);

        const md = new vscode.MarkdownString('', true);
        md.isTrusted = true;
        md.supportThemeIcons = true;

        md.appendMarkdown(`### Podman Machine Status\n`);

        if (stderr?.includes('command not found') || stderr?.includes('is not recognized')) {
            md.appendMarkdown(`⛔ Podman is not installed on this system.\n`);
        } else if (os.platform() === 'linux') {
            md.appendMarkdown(`🐧 Podman on Linux runs containers using host kernel namespaces/cgroups, no VM required.\n`);
        } else if (exitCode !== 0 || !stdout) {
            md.appendMarkdown(`⚠️ Podman machine not setup\n`);
            md.appendMarkdown(`\n---\n\n`);
            md.appendMarkdown(`[➕ Create New Machine](command:podmanStatusMonitor.createPodmanMachine)\n`);
            md.appendMarkdown(`\n---\n\n`);
            md.appendMarkdown(`[🔄 Refresh](command:podman.refreshStatus)\n`);
        } else {
            try {
                const machines = stdout
                    .trim()
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => JSON.parse(line));

                if (machines.length === 0) {
                    md.appendMarkdown(`No Podman machines found\n`);
                    md.appendMarkdown(`\n---\n\n`);
                } else {
                    machines.forEach((m: any) => {
                        const cleanName = m.Name.replace(/\*$/, '');
                        const status = m.Running ? '🟢 Running' : '🟥 Stopped';
                        md.appendMarkdown(`${status}  **${cleanName}**\n\n`)
                        md.appendMarkdown(`[🔄 Refresh](command:podman.refreshStatus)\n`);
                        // Add an option to delete the machine
                        md.appendMarkdown(`[🗑️ Delete](command:podmanStatusMonitor.deletePodmanMachine?${encodeURIComponent(JSON.stringify(cleanName))})\n`);
                        // Add an option to start/stop the machine based on its current status
                        if (m.Running) {
                            md.appendMarkdown(`[⏹️ Stop](command:podmanStatusMonitor.stopPodman?${encodeURIComponent(JSON.stringify(cleanName))})\n`);
                        } else {
                            md.appendMarkdown(`[▶️ Start](command:podmanStatusMonitor.startPodman?${encodeURIComponent(JSON.stringify(cleanName))})\n`);
                        }
                        md.appendMarkdown(`\n---\n\n`);
                    });
                }
                md.appendMarkdown(`[➕ Create New Machine](command:podmanStatusMonitor.createPodmanMachine)\n`);
            } catch (error) {
                md.appendMarkdown(`Error parsing machine list: ${error}\n`);
            }
        }

        md.appendMarkdown(`\n---\n`);
        md.appendMarkdown(`*Last checked: ${new Date().toLocaleTimeString()}*`);

        return md;
    }
}

export default PodmanManager;