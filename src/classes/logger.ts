import * as vscode from 'vscode';

class Logger {
    private static readonly channel = vscode.window.createOutputChannel(
        'Podman Status Monitor',
        { log: true }
    );
    public static readonly buffer: string[] = [];

    public static info(message: string): void {
        this.buffer.push(`INFO: ${message}`);
        this.channel.info(`${message}`);
    }

    public static error(message: string): void {
        this.buffer.push(`ERROR: ${message}`);
        this.channel.error(`${message}`);
        this.channel.show();
    }

    public static warn(message: string): void {
        this.buffer.push(`WARN: ${message}`);
        this.channel.warn(`${message}`);
        this.channel.show(true);
    }
}

export default Logger;