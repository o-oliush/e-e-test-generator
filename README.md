# Playwright Test Generator (VS Code Extension)

Generate Playwright tests from a browser screen recording or a text description.

## Quick Start

1. **Prerequisites**
   - Node.js 18+
   - VS Code 1.85+
   - (Optional for video path) Python 3 + Tesseract (for Phase 2)

2. **Install deps & build**
   ```bash
   npm install
   npm run compile
   ```

3. **Launch Extension**

   * Open this folder in VS Code.
   * Press `F5` to debug (launches the Extension Development Host).
   * Run command: **TestGen: Generate Playwright Test from Text**
   * Try: *"Go to http://localhost:3000, click Login, fill Email with user@example.com, fill Password with secret, click Submit, expect Welcome"*

4. **Output**

   * The test is written to `tests/generated_test.spec.ts` and opened in the editor.

## Settings

* `testgen.pythonPath`: Python executable (default `python3`).
* `testgen.videoProcessorPath`: Path to `video_processor.py` (Phase 2).
* `testgen.outputDir`: Folder to write tests (default `tests`).
* `testgen.baseUrl`: Used if no navigation is detected.

## Next Steps (Phase 2)

* Add `video_processor.py` with FFmpeg + OCR to emit actions JSON.
* Enhance text parser with an LLM or a proper grammar.
* Add Git/PR automation via `simple-git` or GitHub CLI.
* Optional: Validate selectors by launching Playwright in headless mode.
