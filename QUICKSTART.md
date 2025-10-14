# Quick Start Guide

## 🚀 Getting Started

Your VS Code extension is now ready to use! Here's how to test it:

### 1. Launch the Extension Development Host

Press **F5** in VS Code to open a new window with your extension loaded.

### 2. Test the Text-to-Test Feature

1. In the Extension Development Host window, open the Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P**)
2. Type and select: **TestGen: Generate Playwright Test from Text**
3. Enter a test description like:
   ```
   Go to http://localhost:3000, click Login, fill Email with user@example.com, fill Password with secret, click Submit, expect Welcome
   ```
4. The generated test will be created in `tests/generated_test.spec.ts` and opened automatically

### 3. Test the Video-to-Test Feature (with Mock Data)

1. Open Command Palette
2. Select: **TestGen: Generate Playwright Test from Video**
3. Select any video file (mp4, mov, mkv, or webm)
4. Since `video_processor.py` doesn't exist yet, it will use mock data to generate a test

## 📝 Generated Test Example

The extension will generate a Playwright test file like:

```typescript
import { test, expect } from '@playwright/test';

test('Generated Flow from Text', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

## ⚙️ Configuration

You can customize settings in VS Code settings (File > Preferences > Settings):

- **TestGen: Python Path** - Path to Python executable (default: `python3`)
- **TestGen: Video Processor Path** - Path to the video processor script
- **TestGen: Output Dir** - Where to save generated tests (default: `tests`)
- **TestGen: Base Url** - Default base URL for tests (default: `http://localhost:3000`)

## 🔧 Development Commands

- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch mode for development
- `npm run lint` - Run ESLint
- `npm run package` - Package the extension as .vsix

## 🎯 Next Steps (Phase 2)

1. **Video Processing**: Create `video_processor.py` with FFmpeg + OCR to analyze screen recordings
2. **Enhanced Text Parsing**: Integrate an LLM or build a better parser for natural language
3. **Git/PR Automation**: Use `simple-git` to create branches and PRs automatically
4. **Selector Validation**: Launch Playwright in headless mode to verify generated selectors

## 📚 Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Playwright Documentation](https://playwright.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

Happy Testing! 🎭
