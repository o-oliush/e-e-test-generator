import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';

export class PythonBridge {
  constructor(
    private readonly pythonPath: string,
    private readonly scriptPath: string
  ) {}

  async processVideo(videoPath: string): Promise<any> {
    // If the script is missing, return a mock response to keep dev loop tight.
    const exists = await this.pathExists(this.scriptPath);
    if (!exists) {
      return this.mockActions();
    }

    const args = [this.scriptPath, '--video', videoPath];
    const proc = spawn(this.pythonPath, args, {
      cwd: path.dirname(this.scriptPath)
    });

    let stdout = '';
    let stderr = '';

    return await new Promise((resolve, reject) => {
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`video_processor exited with ${code}: ${stderr}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse processor output: ${e}`));
        }
      });
    });
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(p));
      return stat.type === vscode.FileType.File;
    } catch {
      return false;
    }
  }

  private mockActions() {
    // Simple, deterministic mock for day-1 development.
    return {
      actions: [
        { kind: 'navigate', url: 'http://localhost:3000' },
        { kind: 'click', role: 'button', name: 'Login' },
        { kind: 'type', label: 'Email', value: 'user@example.com' },
        { kind: 'type', label: 'Password', value: 'secret' },
        { kind: 'click', role: 'button', name: 'Submit' },
        { kind: 'assert', text: 'Welcome' }
      ]
    };
  }
}
