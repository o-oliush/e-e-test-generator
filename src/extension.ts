import * as vscode from 'vscode';
import * as path from 'path';
import { PythonBridge } from './pythonBridge';
import { generateTestFile } from './generator';
import { Action } from './types';

export function activate(context: vscode.ExtensionContext) {
  const disposableVideo = vscode.commands.registerCommand('testgen.generateFromVideo', async () => {
    try {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) {
        vscode.window.showErrorMessage('Open a workspace folder first.');
        return;
      }

      const uri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        title: 'Select screen recording (mp4/mov)',
        filters: { Video: ['mp4', 'mov', 'mkv', 'webm'] }
      });
      if (!uri || uri.length === 0) return;

      const cfg = vscode.workspace.getConfiguration('testgen');
      const pythonPath = cfg.get<string>('pythonPath', 'python3');
      const processorPath = cfg.get<string>('videoProcessorPath', path.join(ws.uri.fsPath, 'video_processor.py'));

      const bridge = new PythonBridge(pythonPath, processorPath);
      vscode.window.setStatusBarMessage('TestGen: Processing video…');
      const result = await bridge.processVideo(uri[0].fsPath);
      vscode.window.setStatusBarMessage('');

      const actions: Action[] = result.actions || [];
      if (!actions.length) {
        vscode.window.showWarningMessage('No actions detected. Generated a skeleton test.');
      }

      await generateTestFile(actions, ws, 'Generated Flow from Video');
    } catch (err: any) {
      vscode.window.showErrorMessage(`TestGen error: ${err?.message || err}`);
    }
  });

  const disposableText = vscode.commands.registerCommand('testgen.generateFromText', async () => {
    try {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) {
        vscode.window.showErrorMessage('Open a workspace folder first.');
        return;
      }

      const text = await vscode.window.showInputBox({
        prompt: 'Describe the test steps (e.g., Go to /, click Login, fill Email, click Submit, expect Welcome).'
      });
      if (!text) return;

      // Extremely simple text → actions parser (MVP placeholder)
      const actions = naiveParseTextToActions(text);
      await generateTestFile(actions, ws, 'Generated Flow from Text');
    } catch (err: any) {
      vscode.window.showErrorMessage(`TestGen error: ${err?.message || err}`);
    }
  });

  context.subscriptions.push(disposableVideo, disposableText);
}

export function deactivate() {}

function naiveParseTextToActions(s: string): Action[] {
  const lower = s.toLowerCase();
  const actions: Action[] = [] as any;

  // Very simple heuristics; replace with LLM or better parser later.
  if (lower.includes('go to') || lower.includes('navigate')) {
    const m = s.match(/go to\s+([^,]+)/i) || s.match(/navigate\s+to\s+([^,]+)/i);
    if (m) actions.push({ kind: 'navigate', url: m[1].trim() } as any);
  }
  const clickMatches = s.matchAll(/click\s+([^,]+)/gi);
  for (const m of clickMatches) {
    const name = m[1].trim();
    actions.push({ kind: 'click', role: 'button', name } as any);
  }
  const fillMatches = s.matchAll(/fill\s+([^,]+)\s+with\s+([^,]+)/gi);
  for (const m of fillMatches) {
    actions.push({ kind: 'type', label: m[1].trim(), value: m[2].trim() } as any);
  }
  const expectMatches = s.matchAll(/expect\s+([^,]+)/gi);
  for (const m of expectMatches) {
    actions.push({ kind: 'assert', text: m[1].trim() } as any);
  }
  return actions;
}
