import * as path from 'path';
import * as vscode from 'vscode';
import { Action } from './types';

function line(s = '') { return s + '\n'; }

function locatorForClick(a: any): string {
  if (a.testId) return `page.getByTestId(${JSON.stringify(a.testId)})`;
  if (a.role && a.name) return `page.getByRole(${JSON.stringify(a.role)}, { name: ${JSON.stringify(a.name)} })`;
  if (a.name) return `page.getByText(${JSON.stringify(a.name)})`;
  if (a.selector) return `page.locator(${JSON.stringify(a.selector)})`;
  // Fallback, extremely generic — user should refine
  return `page.getByRole('button')`;
}

function locatorForType(a: any): string {
  if (a.selector) return `page.locator(${JSON.stringify(a.selector)})`;
  if (a.label) return `page.getByLabel(${JSON.stringify(a.label)})`;
  if (a.testId) return `page.getByTestId(${JSON.stringify(a.testId)})`;
  // Worst-case fallback
  return `page.getByRole('textbox')`;
}

function assertionFor(a: any): string {
  if (a.selector) return `await expect(page.locator(${JSON.stringify(a.selector)})).toBeVisible()`;
  if (a.text) return `await expect(page.getByText(${JSON.stringify(a.text)})).toBeVisible()`;
  return `// TODO: add assertion`;
}

export async function generateTestFile(
  actions: Action[],
  workspaceFolder: vscode.WorkspaceFolder,
  testName = 'Generated Flow'
) {
  const cfg = vscode.workspace.getConfiguration('testgen');
  const outputRel = cfg.get<string>('outputDir', 'tests');
  const baseUrl = cfg.get<string>('baseUrl', 'http://localhost:3000');

  const filePath = path.join(workspaceFolder.uri.fsPath, outputRel, 'generated_test.spec.ts');

  let code = '';
  code += line(`import { test, expect } from '@playwright/test';`);
  code += line();
  code += line(`test(${JSON.stringify(testName)}, async ({ page }) => {`);

  let hasNavigate = actions.some(a => a.kind === 'navigate');
  if (!hasNavigate) {
    code += line(`  // No explicit navigation detected; use baseUrl from settings`);
    code += line(`  await page.goto(${JSON.stringify(baseUrl)});`);
  }

  for (const a of actions) {
    switch (a.kind) {
      case 'navigate':
        code += line(`  await page.goto(${JSON.stringify((a as any).url)});`);
        break;
      case 'click': {
        const loc = locatorForClick(a);
        code += line(`  await ${loc}.click();`);
        break;
      }
      case 'type': {
        const loc = locatorForType(a);
        code += line(`  await ${loc}.fill(${JSON.stringify((a as any).value)});`);
        break;
      }
      case 'assert': {
        code += line(`  ${assertionFor(a)};`);
        break;
      }
      default:
        code += line(`  // TODO: unsupported action ${JSON.stringify(a)}`);
    }
  }

  code += line(`});`);

  // Ensure folder exists
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(filePath)));
  await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(code, 'utf8'));

  // Open file in editor
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc, { preview: false });

  vscode.window.showInformationMessage(`Test written to ${path.relative(workspaceFolder.uri.fsPath, filePath)}`);
}
