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
    result: container.querySelector('.test-result'),
    historyToggle: container.querySelector('.history-toggle'),
    historyPanel: container.querySelector('.history-panel'),
    historyList: container.querySelector('.history-list'),
    historyEmpty: container.querySelector('.history-empty')
  };
}

function resetFeedback(container, { preserveHistory = false, showPlaceholder = true } = {}) {
  const { wrapper, chip, summary, meta, toggle, result, historyToggle, historyPanel, historyList, historyEmpty } = getFeedbackElements(container);
  if (!wrapper) return;

  wrapper.hidden = true;

  if (chip) {
    chip.textContent = '';
    chip.className = 'status-chip';
    chip.hidden = true;
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

  if (historyToggle) {
    if (preserveHistory) {
      historyToggle.hidden = false;
      historyToggle.disabled = false;
      const isExpanded = historyToggle.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        historyToggle.textContent = 'Hide run history';
      } else {
        historyToggle.textContent = historyToggle.dataset.showLabel || historyToggle.textContent || 'Show run history';
      }
    } else {
      historyToggle.hidden = true;
      historyToggle.disabled = false;
      historyToggle.textContent = historyToggle.dataset.showLabel || 'Show run history';
      historyToggle.setAttribute('aria-expanded', 'false');
      delete historyToggle.dataset.loaded;
    }
  }

  if (historyPanel) {
    if (!preserveHistory) {
      historyPanel.hidden = true;
    }
  }

  if (!preserveHistory) {
    if (historyList) {
      historyList.innerHTML = '';
    }
    if (historyEmpty) {
      historyEmpty.hidden = true;
    }
  }

  if (showPlaceholder) {
    showNoRunState(container);
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

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function describeOutcome(analysis = {}) {
  if (analysis.success === true) return 'Pass';
  if (analysis.success === false) return 'Fail';
  return 'Unknown';
}

function outcomeClass(analysis = {}) {
  if (analysis.success === true) return 'history-item-success';
  if (analysis.success === false) return 'history-item-failure';
  return 'history-item-unknown';
}

function buildHistoryMeta(analysis = {}) {
  const parts = [];
  if (typeof analysis.confidence === 'number') {
    const confidencePercent = Math.round(Math.max(0, Math.min(1, analysis.confidence)) * 100);
    parts.push(`Confidence: ${confidencePercent}%`);
  }
  const methodLabel = formatAnalysisMethod(analysis.method);
  if (methodLabel) {
    parts.push(methodLabel);
  }
  return parts.join(' • ');
}

function getHistoryToggleLabel(entries) {
  const count = Array.isArray(entries) ? entries.length : 0;
  return count > 0 ? `Show run history (${count})` : 'Show run history';
}

function renderHistoryList(entries, listElement, emptyElement) {
  if (!listElement) return;
  listElement.innerHTML = '';

  if (!entries || entries.length === 0) {
    if (emptyElement) {
      emptyElement.hidden = false;
      emptyElement.textContent = 'No previous runs yet.';
    }
    return;
  }

  if (emptyElement) {
    emptyElement.hidden = true;
  }

  entries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = `history-item ${outcomeClass(entry.analysis)}`;

    const header = document.createElement('div');
    header.className = 'history-item-header';

    const badge = document.createElement('span');
    badge.className = 'history-item-status';
    badge.textContent = describeOutcome(entry.analysis);

    const time = document.createElement('time');
    time.className = 'history-item-time';
    if (entry.timestamp) {
      time.dateTime = entry.timestamp;
    }
    time.textContent = formatTimestamp(entry.timestamp);

    header.appendChild(badge);
    header.appendChild(time);

    item.appendChild(header);

    const trimmedReason = entry.analysis?.reason ? entry.analysis.reason.trim() : '';
    if (trimmedReason) {
      const reasonParagraph = document.createElement('p');
      reasonParagraph.className = 'history-item-reason';
      reasonParagraph.textContent = trimmedReason;
      item.appendChild(reasonParagraph);
    }

    const metaText = buildHistoryMeta(entry.analysis);
    if (metaText) {
      const metaParagraph = document.createElement('p');
      metaParagraph.className = 'history-item-meta';
      metaParagraph.textContent = metaText;
      item.appendChild(metaParagraph);
    }

    listElement.appendChild(item);
  });
}

function setHistoryPanelVisibility(container, open) {
  const { historyToggle, historyPanel } = getFeedbackElements(container);
  if (!historyToggle || !historyPanel) return;
  historyPanel.hidden = !open;
  historyToggle.setAttribute('aria-expanded', String(open));
  const showLabel = historyToggle.dataset.showLabel || 'Show run history';
  historyToggle.textContent = open ? 'Hide run history' : showLabel;
}

function showNoRunState(container) {
  const { wrapper, chip, summary, meta } = getFeedbackElements(container);
  if (!wrapper) return;

  wrapper.hidden = false;

  if (chip) {
    chip.hidden = false;
    chip.textContent = '—';
    chip.className = 'status-chip status-empty';
  }

  if (summary) {
    summary.textContent = 'No runs yet. Click "Run" to capture the first result.';
  }

  if (meta) {
    meta.hidden = false;
    meta.textContent = 'History, logs, and status will appear here after the first execution.';
  }
}

async function fetchTestHistory(fileId, { signal, limit = 20 } = {}) {
  const params = limit ? `?limit=${encodeURIComponent(limit)}` : '';
  const response = await fetch(`/api/tests/${encodeURIComponent(fileId)}/history${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data.entries) ? data.entries : [];
}

async function ensureHistoryLoaded(test, container, { force = false, limit = 25 } = {}) {
  if (!force && Array.isArray(test.historyEntries)) {
    updateHistoryUI(container, test.historyEntries);
    return test.historyEntries;
  }

  if (!force && test.historyPromise) {
    const entries = await test.historyPromise;
    updateHistoryUI(container, entries);
    return entries;
  }

  const { historyToggle, historyEmpty } = getFeedbackElements(container);

  if (historyEmpty) {
    historyEmpty.hidden = true;
  }

  if (historyToggle) {
    historyToggle.disabled = true;
    historyToggle.textContent = 'Loading history...';
  }

  const loadPromise = (async () => {
    const entries = await fetchTestHistory(test.fileId, { limit });
    return entries;
  })();

  test.historyPromise = loadPromise;

  try {
    const entries = await loadPromise;
    test.historyEntries = entries;
    test.historyLoaded = true;
    updateHistoryUI(container, entries);
    if (historyEmpty && (!entries || entries.length === 0)) {
      historyEmpty.hidden = false;
      historyEmpty.textContent = 'No previous runs yet.';
    }
    return entries;
  } catch (error) {
    console.error('Failed to load test history', error);
    if (historyEmpty) {
      historyEmpty.hidden = false;
      historyEmpty.textContent = `Failed to load history: ${error.message}`;
    }
    if (historyToggle) {
      historyToggle.hidden = false;
      historyToggle.disabled = false;
      historyToggle.dataset.showLabel = historyToggle.dataset.showLabel || 'Show run history';
      historyToggle.textContent = historyToggle.dataset.showLabel;
      delete historyToggle.dataset.loaded;
    }
    return [];
  } finally {
    if (test.historyPromise === loadPromise) {
      delete test.historyPromise;
    }
  }
}

function applyLatestHistorySnapshot(test, container, entry) {
  if (container.dataset.running === 'true') return;

  const latestEntry = entry || (Array.isArray(test.historyEntries) ? test.historyEntries[0] : null);
  if (!latestEntry) {
    showNoRunState(container);
    return;
  }

  const analysis = latestEntry.analysis || {};
  let state = 'unknown';
  if (typeof analysis.success === 'boolean') {
    state = analysis.success ? 'success' : 'failure';
  }

  const message = typeof analysis.reason === 'string' ? analysis.reason : undefined;

  updateFeedback(container, {
    state,
    analysis,
    rawResult: typeof latestEntry.result === 'string' ? latestEntry.result : '',
    message
  });
}

function hydrateHistoryPreview(test, container) {
  if (test.historyHydrationRequested) return;
  test.historyHydrationRequested = true;

  setTimeout(() => {
    ensureHistoryLoaded(test, container)
      .then((entries) => {
        applyLatestHistorySnapshot(test, container, entries && entries.length > 0 ? entries[0] : null);
      })
      .catch((error) => {
        console.error('Failed to hydrate history preview', error);
      });
  }, 0);
}

function updateHistoryUI(container, entries) {
  const { historyToggle, historyList, historyEmpty } = getFeedbackElements(container);
  if (!historyToggle || !historyList) return;

  const { historyPanel } = getFeedbackElements(container);
  const wasOpen = historyPanel ? historyPanel.hidden === false || historyToggle.getAttribute('aria-expanded') === 'true' : false;

  renderHistoryList(entries, historyList, historyEmpty);
  const label = getHistoryToggleLabel(entries);
  historyToggle.dataset.showLabel = label;
  historyToggle.hidden = false;
  historyToggle.disabled = false;
  if (wasOpen) {
    historyToggle.textContent = 'Hide run history';
    historyToggle.setAttribute('aria-expanded', 'true');
    if (historyPanel) {
      historyPanel.hidden = false;
    }
  } else {
    historyToggle.textContent = label;
    historyToggle.setAttribute('aria-expanded', 'false');
    if (historyPanel) {
      historyPanel.hidden = true;
    }
  }
  historyToggle.dataset.loaded = 'true';
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
    chip.hidden = false;
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
  resetFeedback(container, { preserveHistory: true, showPlaceholder: false });
  container.dataset.running = 'true';
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

    if (test.historyLoaded) {
      const entry = data.historyEntry;
      if (entry) {
        test.historyEntries = [entry, ...(test.historyEntries || [])];
      }
      updateHistoryUI(container, test.historyEntries || []);
      if ((test.historyEntries || []).length > 0) {
        setHistoryPanelVisibility(container, true);
      }
    } else {
      const entries = await ensureHistoryLoaded(test, container, { force: true });
      if (data.historyEntry && entries.length > 0 && data.historyEntry.timestamp !== entries[0]?.timestamp) {
        entries.unshift(data.historyEntry);
        test.historyEntries = entries;
      }
      updateHistoryUI(container, test.historyEntries || entries || []);
      if ((test.historyEntries || entries || []).length > 0) {
        setHistoryPanelVisibility(container, true);
      }
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
    delete container.dataset.running;
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
  const historyToggle = container.querySelector('.history-toggle');
  const historyPanel = container.querySelector('.history-panel');
  const historyList = container.querySelector('.history-list');
  const historyEmpty = container.querySelector('.history-empty');

  if (resultToggleButton && resultContentElement) {
    resultToggleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleResultVisibility(resultToggleButton, resultContentElement);
    });
  }
  if (historyToggle && historyPanel) {
    historyToggle.addEventListener('click', async (event) => {
      event.stopPropagation();

      if (!historyToggle.dataset.loaded) {
        await ensureHistoryLoaded(test, container, { force: true });
      }

      const isOpen = historyPanel.hidden === false;
      setHistoryPanelVisibility(container, !isOpen);
      if (!isOpen) {
        historyPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  if (historyPanel && historyList) {
    const historyId = `test-history-${test.fileId.replace(/[^a-zA-Z0-9_-]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
    historyPanel.id = historyId;
    if (historyToggle && !historyToggle.getAttribute('aria-controls')) {
      historyToggle.setAttribute('aria-controls', historyId);
    }
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
  if (historyToggle) {
    historyToggle.hidden = false;
    historyToggle.disabled = false;
    const initialLabel = historyToggle.dataset.showLabel || 'Show run history';
    historyToggle.textContent = initialLabel;
    historyToggle.setAttribute('aria-expanded', 'false');
  }
  if (historyPanel) {
    historyPanel.hidden = true;
  }
  if (historyList) {
    historyList.innerHTML = '';
  }
  if (historyEmpty) {
    historyEmpty.hidden = true;
  }

  hydrateHistoryPreview(test, container);

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
