import * as vscode from 'vscode';

// Unified status state
interface SectionStatus {
    label: string;
    detail: string;
    isError: boolean;
    isWarning: boolean;
}

const podmanStatus: {
    podmanMachine: SectionStatus;
} = {
    podmanMachine: {
        label: '$(loading~spin) Checking Podman status...',
        detail: 'Checking status...',
        isError: false,
        isWarning: false
    }
}

class UnifiedStatusBar {

    updateUnifiedStatusBar(statusbar: vscode.StatusBarItem): void {
        statusbar.text = `$(loading~spin) Checking Podman status... `;

        const md = new vscode.MarkdownString('', true);
        md.isTrusted = true;
        md.supportThemeIcons = true;

        md.appendMarkdown(`### Podman Machine Status\n`);
        md.appendMarkdown(`- **Podman**: ${podmanStatus.podmanMachine.label}\n`);
        md.appendMarkdown(`\n---\n`);
        // give an option to create new machines
        md.appendMarkdown(`[➕ Create New Machine](command:podmanStatusMonitor.createPodmanMachine)\n`);
        md.appendMarkdown(`\n---\n`);
        md.appendMarkdown(`[🔄 Refresh](command:podman.refreshStatus)`);
        md.appendMarkdown(`\n---\n`);
        md.appendMarkdown(`*Last checked: ${new Date().toLocaleTimeString()}*\n\n`);
        statusbar.tooltip = md;
    }
}

export default UnifiedStatusBar;