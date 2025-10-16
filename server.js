const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');

// this object help to identify if the test passed or failed based on the LLM output
const TestResultAnalyzer = require('./testResultAnalyzer');

const app = express();
const PORT = process.env.PORT || 3000;

const testsDir = path.join(__dirname, 'tests');
const uploadsDir = path.join(__dirname, 'uploads');

for (const dir of [testsDir, uploadsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}-${safeOriginal}`);
  }
});

const upload = multer({ storage });

const openAIapiKey = 'api_key';
const defaultModel = 'gpt-5';
const openai = new OpenAI({ apiKey: openAIapiKey });

// Initialize test result analyzer
const testAnalyzer = new TestResultAnalyzer(openAIapiKey, defaultModel);

async function callOpenAI({ systemPrompt, userPrompt }) {
  if (!openai) {
    return {
      content: 'OpenAI API key not configured. Set OPENAI_API_KEY to enable AI responses.'
    };
  }

  const completion = await openai.chat.completions.create({
    model: defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });

  return completion.choices[0]?.message ?? { content: '' };
}

function extractTitleAndPreview(content) {
  const titleMatch = content.match(/^#\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Test';
  const preview = content.replace(/\s+/g, ' ').slice(0, 160);
  return { title, preview };
}

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  res.json({
    fileId: req.file.filename,
    originalName: req.file.originalname
  });
});

app.get('/api/tests', async (_req, res) => {
  try {
    const files = await fs.promises.readdir(testsDir);
    const tests = await Promise.all(
      files
        .filter((file) => file.endsWith('.md'))
        .map(async (file) => {
          const fullPath = path.join(testsDir, file);
          const content = await fs.promises.readFile(fullPath, 'utf8');
          const { title, preview } = extractTitleAndPreview(content);
          const firstLine = (content
            .split(/\r?\n/)
            .find((line) => line.trim().length > 0) || '')
            .trim();
          return {
            fileId: file,
            title,
            preview,
            firstLine,
            updatedAt: (await fs.promises.stat(fullPath)).mtime
          };
        })
    );

    tests.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json(tests);
  } catch (error) {
    console.error('Failed to load tests', error);
    res.status(500).json({ error: 'Failed to load tests.' });
  }
});

app.get('/api/tests/:fileId', async (req, res) => {
  const safeFile = path.basename(req.params.fileId);
  const testPath = path.join(testsDir, safeFile);

  try {
    const content = await fs.promises.readFile(testPath, 'utf8');
    const { title } = extractTitleAndPreview(content);
    res.json({
      fileId: safeFile,
      title,
      content
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Test file not found.' });
    }
    console.error('Failed to load test content', error);
    res.status(500).json({ error: 'Failed to load test content.' });
  }
});

app.post('/api/message', async (req, res) => {
  const { message, files = [] } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    let promptWithFiles = message;

    for (const file of files) {
      if (!file?.fileId) continue;
      const filePath = path.join(uploadsDir, path.basename(file.fileId));
      if (!fs.existsSync(filePath)) continue;
      const fileBuffer = await fs.promises.readFile(filePath);
      const base64 = fileBuffer.toString('base64');
      const label = file.originalName || file.fileId;
      promptWithFiles += `\n\nAttached file (${label}) base64:\n${base64}`;
    }

    const systemPrompt = 'You are an AI assistant that generates high-quality end-to-end test prompts in Markdown format. Include clear titles and step-by-step instructions.';
    const aiMessage = await callOpenAI({
      systemPrompt,
      userPrompt: promptWithFiles
    });

    const aiContent = aiMessage.content || '';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-${timestamp}.md`;
    const filePath = path.join(testsDir, filename);
    await fs.promises.writeFile(filePath, aiContent, 'utf8');

    const { title, preview } = extractTitleAndPreview(aiContent);

    res.json({
      response: aiContent,
      savedTest: {
        fileId: filename,
        title,
        preview
      }
    });
  } catch (error) {
    console.error('Failed to process message', error);
    res.status(500).json({ error: 'Failed to process message.' });
  }
});

app.post('/api/tests/:fileId/run', async (req, res) => {
  const safeFile = path.basename(req.params.fileId);
  const testPath = path.join(testsDir, safeFile);

  try {
    const content = await fs.promises.readFile(testPath, 'utf8');
    const systemPrompt = 'You are an AI test executor. Given a Markdown test prompt, simulate running the test and report results.';
    const userPrompt = `Execute or verify the following test prompt:\n\n${content}`;
    const aiMessage = await callOpenAI({ systemPrompt, userPrompt });

    const aiContent = aiMessage.content || '';
    
    // Analyze the test result to determine success/failure
    const analysis = await testAnalyzer.analyzeTestResult(aiContent);

    res.json({
      result: aiContent,
      test: {
        fileId: safeFile
      },
      analysis: {
        success: analysis.success,
        confidence: analysis.confidence,
        reason: analysis.reason,
        method: analysis.method
      }
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Test file not found.' });
    }
    console.error('Failed to run test', error);
    res.status(500).json({ error: 'Failed to run test.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/test1', async (_req, res) => {

  const testResult = `
      ## Test Results for Best Laptop Deals

### Test Execution Summary
The end-to-end test script for "Best Laptop Deals" was executed as per the provided steps. Below is the report detailing each step, including actions taken, observations, and whether the expectations were met.

### Step-by-Step Results

1. **Navigate to https://www.bestlaptop.deals.**
   - **Result**: Navigation successful. The page loads without any issues.

2. **Focus on the search bar and type "laptop".**
   - **Result**: Focused successfully, typed "laptop".

3. **Click the search button next to the search bar.**
   - **Result**: Search initiated; results page loading.

4. **Confirm that the search results header indicates results for "laptop".**
   - **Result**: Search results header confirmed, displaying results relevant to "laptop".

5. **Hover over the "Brands" filter section.**
   - **Result**: Hover action successful; the filter menu displayed.

6. **Click to open the brand dropdown menu.**
   - **Result**: Dropdown menu opened successfully.

7. **Select the Dell checkbox from the dropdown options.**
   - **Result**: Dell checkbox selected.

8. **Click the apply button to apply the selected filters.**
   - **Result**: Filter applied successfully; results refreshed.

9. **Verify that results are updated to display only Dell laptops.**
   - **Result**: Results confirmed to display only Dell laptops.

10. **Hover over the first laptop displayed in the search results.**
    - **Result**: Hover action successful; additional options displayed.

11. **Click the details button for that laptop.**
    - **Result**: Navigated to the laptop details page successfully.

12. **Wait for the laptop details page to fully load.**
    - **Result**: Laptop details page loaded completely.

13. **Click the "Add to Cart" button on the laptop details page.**
    - **Result**: Laptop successfully added to the shopping cart.

14. **Click the cart icon in the top right corner.**
    - **Result**: Cart opened successfully.

15. **Verify that the item is present in the shopping cart.**
    - **Result**: Item confirmed in the shopping cart.

### Final Outcome
- **Confirmation that Dell brand laptops are displayed**: **Successful**
- **Successful navigation to the laptop details page**: **Successful**
- **Confirmation that the laptop has been added to the shopping cart**: **Successful**

### Overall Test Conclusion
The test executions for navigating, filtering, and adding items to the cart on the "Best Laptop Deals" website were all successful. All actions performed as intended, and the expectations were met successfully throughout the test. 

**All steps executed without errors, and the expected results were validated.** The test has been concluded with a status of **PASS**.
      `;
      const result = await testAnalyzer.analyzeTestResult(testResult);
      
      // expect(result.success).toBe(true);
      // expect(result.confidence).toBeGreaterThan(0.7);
      
      res.json({ status: 'ok', result: result.success, confidence: result.confidence, expectedReasult: true });
});

app.get('/api/test2', async (_req, res) => {
   const testResult = `
      ## Test Results for Best Laptop Deals

### Test Execution Summary
The end-to-end test script for "Best Laptop Deals" was executed as per the provided steps. Below is the report detailing each step, including actions taken, observations, and whether the expectations were met.

### Step-by-Step Results

1. **Navigate to https://www.bestlaptop.deals.**
   - **Result**: Navigation successful. The page loads without any issues.

2. **Focus on the search bar and type "laptop".**
   - **Result**: Focused successfully, typed "laptop".

3. **Click the search button next to the search bar.**
   - **Result**: Search initiated; results page loading.

4. **Confirm that the search results header indicates results for "laptop".**
   - **Result**: Search results header confirmed, displaying results relevant to "laptop".

5. **Hover over the "Brands" filter section.**
   - **Result**: Hover action successful; the filter menu displayed.

6. **Click to open the brand dropdown menu.**
   - **Result**: Dropdown menu opened successfully.

7. **Select the Dell checkbox from the dropdown options.**
   - **Result**: Dell checkbox selected.

8. **Click the apply button to apply the selected filters.**
   - **Result**: Filter applied successfully; results refreshed.

9. **Verify that results are updated to display only Dell laptops.**
   - **Result**: Results confirmed to display only Dell laptops.

10. **Hover over the first laptop displayed in the search results.**
    - **Result**: Hover action successful; additional options displayed.

11. **Click the details button for that laptop.**
    - **Result**: Navigated to the laptop details page successfully.

12. **Wait for the laptop details page to fully load.**
    - **Result**: Laptop details page loaded completely.

13. **Click the "Add to Cart" button on the laptop details page.**
    - **Result**: Laptop successfully added to the shopping cart.

14. **Click the cart icon in the top right corner.**
    - **Result**: Cart opened successfully.

15. **Verify that the item is present in the shopping cart.**
    - **Result**: Item confirmed in the shopping cart.

### Final Outcome
- **Confirmation that Dell brand laptops are displayed**: **Failed**
- **Successful navigation to the laptop details page**: **Successful**
- **Confirmation that the laptop has been added to the shopping cart**: **Successful**

### Overall Test Conclusion
The test executions for navigating, filtering, and adding items to the cart on the "Best Laptop Deals" website were all failed. All actions performed as intended, and the expectations were met successfully throughout the test.

**Some steps executed with errors, and the expected results were validated.** The test has been concluded with a status of **FAIL**.
      `;
      const result = await testAnalyzer.analyzeTestResult(testResult);
      console.log('Test analysis result:', result);
      // expect(result.success).toBe(false);
      // expect(result.confidence).toBeGreaterThan(0.7);
  res.json({ status: 'ok', result: result.success, confidence: result.confidence, expectedReasult: false });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
