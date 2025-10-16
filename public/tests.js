const testsList = document.getElementById('tests-list');
const testTemplate = document.getElementById('test-item-template');

function getFeedbackElements(container) {
  return {
    wrapper: container.querySelector('.test-feedback'),
    status: container.querySelector('.test-status'),
    chip: container.querySelector('.status-chip'),
    summary: container.querySelector('.status-summary'),
    meta: container.querySelector('.status-meta'),
    toggle: container.querySelector('.result-toggle'),
    result: container.querySelector('.test-result')
  };
}

function resetFeedback(container) {
  const { wrapper, chip, summary, meta, toggle, result } = getFeedbackElements(container);
  if (!wrapper) return;

  wrapper.hidden = true;

  if (chip) {
    chip.textContent = '';
    chip.className = 'status-chip';
  }

  if (summary) {
    summary.textContent = '';
  }

  if (meta) {
    meta.textContent = '';
    meta.hidden = true;
  }

  if (toggle) {
    toggle.hidden = true;
    toggle.textContent = 'View execution log';
    toggle.setAttribute('aria-expanded', 'false');
  }

  if (result) {
    result.hidden = true;
    result.innerHTML = '';
  }
}

function toggleResultVisibility(toggleButton, resultElement) {
  if (!toggleButton || !resultElement) return;

  const shouldShow = resultElement.hidden;
  resultElement.hidden = !shouldShow;
  toggleButton.textContent = shouldShow ? 'Hide execution log' : 'View execution log';
  toggleButton.setAttribute('aria-expanded', String(shouldShow));

  if (shouldShow) {
    resultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function getAnalysisMeta(analysis = {}, methodLabel) {
  const parts = [];
  if (typeof analysis.confidence === 'number') {
    const confidencePercent = Math.round(Math.max(0, Math.min(1, analysis.confidence)) * 100);
    parts.push(`Confidence: ${confidencePercent}%`);
  }
  if (methodLabel) {
    parts.push(methodLabel);
  }
  return parts.join(' • ');
}

function formatAnalysisMethod(method) {
  if (!method || typeof method !== 'string') return null;
  if (method === 'ai-enhanced') {
    return 'Analysis: AI-assisted';
  }
  const cleaned = method.replace(/-/g, ' ').trim();
  if (!cleaned) {
    return null;
  }
  const capitalized = cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  const normalized = capitalized
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bLlms?\b/gi, 'LLM');
  return `Analysis: ${normalized}`;
}

function updateFeedback(container, { state, analysis, rawResult, message }) {
  const elements = getFeedbackElements(container);
  if (!elements.wrapper || !elements.status) return;

  const { wrapper, chip, summary, meta, toggle, result } = elements;

  wrapper.hidden = false;

  let chipLabel = '';
  let chipClass = 'status-chip';
  let summaryText = '';
  let metaText = '';

  const method = formatAnalysisMethod(analysis?.method);
  const trimmedReason = typeof analysis?.reason === 'string' ? analysis.reason.trim() : '';

  switch (state) {
    case 'loading':
      chipLabel = 'RUNNING';
      chipClass += ' status-loading';
      summaryText = 'Running test...';
      metaText = 'This may take a few seconds.';
      break;
    case 'success':
      chipLabel = 'PASS';
      chipClass += ' status-success';
      summaryText = trimmedReason || 'Test passed successfully.';
      metaText = getAnalysisMeta(analysis, method);
      break;
    case 'failure':
      chipLabel = 'FAIL';
      chipClass += ' status-failure';
      summaryText = trimmedReason || 'Test failed. Review the execution log for details.';
      metaText = getAnalysisMeta(analysis, method);
      break;
    case 'unknown':
      chipLabel = 'UNKNOWN';
      chipClass += ' status-unknown';
      summaryText = trimmedReason || message || 'Result could not be determined. Review the execution log for more context.';
      metaText = getAnalysisMeta(analysis, method);
      break;
    case 'error':
      chipLabel = 'ERROR';
      chipClass += ' status-error';
      summaryText = message || 'Failed to run the test. Please try again.';
      metaText = 'Check your connection or try again later.';
      break;
    default:
      wrapper.hidden = true;
      return;
  }

  if (chip) {
    chip.textContent = chipLabel;
    chip.className = chipClass;
  }

  if (summary) {
    summary.textContent = summaryText;
  }

  if (meta) {
    if (metaText) {
      meta.hidden = false;
      meta.textContent = metaText;
    } else {
      meta.hidden = true;
      meta.textContent = '';
    }
  }

  if (toggle && result) {
    if (rawResult && rawResult.trim().length > 0) {
      result.innerHTML = renderMarkdown(rawResult);
      result.hidden = true;
      toggle.hidden = false;
      toggle.textContent = 'View execution log';
      toggle.setAttribute('aria-expanded', 'false');
    } else {
      toggle.hidden = true;
      toggle.textContent = 'View execution log';
      toggle.setAttribute('aria-expanded', 'false');
      result.hidden = true;
      result.innerHTML = '';
    }
  }
}

function renderMarkdown(markdown) {
  const text = typeof markdown === 'string' ? markdown : '';
  if (window.marked?.parse) {
    const rawHtml = window.marked.parse(text);
    return window.DOMPurify?.sanitize ? window.DOMPurify.sanitize(rawHtml) : rawHtml;
  }

  const escapeHtml = (str) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  return `<pre>${escapeHtml(text)}</pre>`;
}

async function fetchTestContent(test) {
  const response = await fetch(`/api/tests/${encodeURIComponent(test.fileId)}`);
  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }
  return response.json();
}

async function ensureTestContent(test, contentElement) {
  if (contentElement.dataset.loaded === 'true') {
    return true;
  }

  if (typeof test.content === 'string') {
    contentElement.innerHTML = '';
    if (test.content.trim()) {
      contentElement.innerHTML = renderMarkdown(test.content);
    } else {
      const emptyParagraph = document.createElement('p');
      emptyParagraph.className = 'loading';
      emptyParagraph.textContent = 'No content available for this test yet.';
      contentElement.appendChild(emptyParagraph);
    }
    contentElement.dataset.loaded = 'true';
    return true;
  }

  if (contentElement.dataset.loading === 'true') {
    return false;
  }

  contentElement.dataset.loading = 'true';
  contentElement.innerHTML = '';

  const loadingParagraph = document.createElement('p');
  loadingParagraph.className = 'loading';
  loadingParagraph.textContent = 'Loading test content...';
  contentElement.appendChild(loadingParagraph);

  try {
    const data = await fetchTestContent(test);
    const markdown = typeof data.content === 'string' ? data.content : '';
    test.content = markdown;
    contentElement.innerHTML = '';
    if (markdown.trim()) {
      contentElement.innerHTML = renderMarkdown(markdown);
    } else {
      const emptyParagraph = document.createElement('p');
      emptyParagraph.className = 'loading';
      emptyParagraph.textContent = 'No content available for this test yet.';
      contentElement.appendChild(emptyParagraph);
    }
    contentElement.dataset.loaded = 'true';
    return true;
  } catch (error) {
    contentElement.innerHTML = '';
    const errorParagraph = document.createElement('p');
    errorParagraph.className = 'error';
    errorParagraph.textContent = `Failed to load test content: ${error.message}`;
    contentElement.appendChild(errorParagraph);
    console.error('Failed to load test content', error);
    return false;
  } finally {
    delete contentElement.dataset.loading;
  }
}

async function toggleTestContent(test, contentElement, toggleButton) {
  const willExpand = contentElement.hidden;

  if (willExpand) {
    toggleButton.disabled = true;
    try {
      await ensureTestContent(test, contentElement);
      contentElement.hidden = false;
      toggleButton.setAttribute('aria-expanded', 'true');
    } finally {
      toggleButton.disabled = false;
    }
  } else {
    contentElement.hidden = true;
    toggleButton.setAttribute('aria-expanded', 'false');
  }
}

async function runTest(test, container) {
  resetFeedback(container);
  updateFeedback(container, { state: 'loading' });

  const runButton = container.querySelector('.run-button');
  if (runButton) {
    runButton.disabled = true;
  }

  try {
    const response = await fetch(`/api/tests/${encodeURIComponent(test.fileId)}/run`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Run failed with status ${response.status}`);
    }

    const data = await response.json();
    const analysis = data?.analysis;
    const resultText = typeof data?.result === 'string' ? data.result : '';

    if (analysis && typeof analysis.success === 'boolean') {
      updateFeedback(container, {
        state: analysis.success ? 'success' : 'failure',
        analysis,
        rawResult: resultText
      });
    } else {
      updateFeedback(container, {
        state: 'unknown',
        analysis,
        rawResult: resultText,
        message: 'No structured analysis was returned.'
      });
    }
  } catch (error) {
    console.error('Failed to run test', error);
    updateFeedback(container, {
      state: 'error',
      message: `Failed to run test: ${error.message}`
    });
  } finally {
    if (runButton) {
      runButton.disabled = false;
    }
  }
}

function createTestElement(test) {
  const templateContent = testTemplate?.content;
  let container;
  let toggleButton;
  let headingElement;
  let runButton;
  let contentElement;

  if (templateContent) {
    const fragment = templateContent.cloneNode(true);
    container = fragment.querySelector('.test-item');
    toggleButton = fragment.querySelector('.test-toggle');
    headingElement = fragment.querySelector('.test-heading');
    runButton = fragment.querySelector('.run-button');
    contentElement = fragment.querySelector('.test-content');
  } else {
    container = document.createElement('article');
    container.className = 'test-item';

    const header = document.createElement('div');
    header.className = 'test-header';

    toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'test-toggle';
    headingElement = document.createElement('strong');
    headingElement.className = 'test-heading';
    toggleButton.appendChild(headingElement);

    runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'run-button';
    runButton.textContent = 'Run';

    const toolbar = document.createElement('div');
    toolbar.className = 'test-toolbar';
    toolbar.appendChild(runButton);

    header.appendChild(toggleButton);
    header.appendChild(toolbar);

    const feedback = document.createElement('div');
    feedback.className = 'test-feedback';
    feedback.hidden = true;

    const statusContainer = document.createElement('div');
    statusContainer.className = 'test-status';
    statusContainer.setAttribute('aria-live', 'polite');

    const statusChip = document.createElement('span');
    statusChip.className = 'status-chip';
    statusChip.setAttribute('aria-hidden', 'true');

    const statusText = document.createElement('div');
    statusText.className = 'status-text';

    const summaryParagraph = document.createElement('p');
    summaryParagraph.className = 'status-summary';

    const metaParagraph = document.createElement('p');
    metaParagraph.className = 'status-meta';
    metaParagraph.hidden = true;

    statusText.appendChild(summaryParagraph);
    statusText.appendChild(metaParagraph);

    statusContainer.appendChild(statusChip);
    statusContainer.appendChild(statusText);

    const resultToggle = document.createElement('button');
    resultToggle.className = 'result-toggle';
    resultToggle.type = 'button';
    resultToggle.hidden = true;
    resultToggle.textContent = 'View execution log';
    resultToggle.setAttribute('aria-expanded', 'false');

    const resultContainer = document.createElement('div');
    resultContainer.className = 'test-result markdown-content';
    resultContainer.hidden = true;

    feedback.appendChild(statusContainer);
    feedback.appendChild(resultToggle);
    feedback.appendChild(resultContainer);

    contentElement = document.createElement('div');
    contentElement.className = 'test-content markdown-content';
    contentElement.hidden = true;

    container.appendChild(header);
    container.appendChild(feedback);
    container.appendChild(contentElement);
  }

  const resultToggleButton = container.querySelector('.result-toggle');
  const resultContentElement = container.querySelector('.test-result');

  if (resultToggleButton && resultContentElement) {
    resultToggleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleResultVisibility(resultToggleButton, resultContentElement);
    });
  }

  const rawHeading = (test.firstLine || test.title || test.fileId || '').trim() || test.fileId;
  const displayHeading = rawHeading.replace(/^#+\s*/, '').trim() || rawHeading;
  test.headingLabel = displayHeading;

  headingElement.textContent = displayHeading;

  const uniqueId = `test-content-${test.fileId.replace(/[^a-zA-Z0-9_-]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  contentElement.id = uniqueId;
  if (resultContentElement) {
    const resultId = `${uniqueId}-result`;
    resultContentElement.id = resultId;
    if (resultToggleButton) {
      resultToggleButton.setAttribute('aria-controls', resultId);
    }
  }
  if (resultToggleButton && !resultToggleButton.getAttribute('aria-controls')) {
    resultToggleButton.setAttribute('aria-controls', `${uniqueId}-result`);
  }
  toggleButton.setAttribute('aria-controls', uniqueId);
  toggleButton.setAttribute('aria-expanded', 'false');
  toggleButton.setAttribute('title', 'Click to expand or collapse this test prompt');

  container.dataset.fileId = test.fileId;

  toggleButton.addEventListener('click', () => toggleTestContent(test, contentElement, toggleButton));
  runButton.addEventListener('click', (event) => {
    event.stopPropagation();
    runTest(test, container);
  });

  resetFeedback(container);

  return container;
}

function renderTests(tests) {
  if (!testsList) return;
  testsList.innerHTML = '';

  if (!tests || tests.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No stored prompts yet. Generate one from the main page to get started!';
    testsList.appendChild(empty);
    return;
  }

  tests.forEach((test) => {
    testsList.appendChild(createTestElement(test));
  });
}

async function loadTests() {
  if (!testsList) return;
  testsList.innerHTML = '';
  const loading = document.createElement('p');
  loading.textContent = 'Loading stored prompts...';
  loading.className = 'loading';
  testsList.appendChild(loading);

  try {
    const response = await fetch('/api/tests');
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }
    const tests = await response.json();
    renderTests(tests);
  } catch (error) {
    console.error('Failed to load tests', error);
    if (testsList) {
      testsList.innerHTML = '';
      const errorParagraph = document.createElement('p');
      errorParagraph.className = 'error';
      errorParagraph.textContent = `Failed to load stored prompts: ${error.message}`;
      testsList.appendChild(errorParagraph);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadTests();
});
