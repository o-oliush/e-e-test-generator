const testsList = document.getElementById('tests-list');
const testTemplate = document.getElementById('test-item-template');

function setStatus(container, message, variant = 'info') {
  const statusElement = container.querySelector('.test-status');
  if (!statusElement) return;

  if (!message) {
    statusElement.hidden = true;
    statusElement.textContent = '';
    statusElement.className = 'test-status';
    return;
  }

  statusElement.hidden = false;
  statusElement.textContent = message;
  statusElement.className = `test-status status-${variant}`;
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
  setStatus(container, 'Running test...', 'info');
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
    const message = (data.result && data.result.trim()) || 'No response received.';
    setStatus(container, message, 'success');
  } catch (error) {
    console.error('Failed to run test', error);
    setStatus(container, `Failed to run test: ${error.message}`, 'error');
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

  const statusElement = document.createElement('p');
  statusElement.className = 'test-status';
  statusElement.hidden = true;
  statusElement.setAttribute('aria-live', 'polite');

    contentElement = document.createElement('div');
    contentElement.className = 'test-content markdown-content';
    contentElement.hidden = true;

    container.appendChild(header);
    container.appendChild(statusElement);
    container.appendChild(contentElement);
  }

  const rawHeading = (test.firstLine || test.title || test.fileId || '').trim() || test.fileId;
  const displayHeading = rawHeading.replace(/^#+\s*/, '').trim() || rawHeading;
  test.headingLabel = displayHeading;

  headingElement.textContent = displayHeading;

  const uniqueId = `test-content-${test.fileId.replace(/[^a-zA-Z0-9_-]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  contentElement.id = uniqueId;
  toggleButton.setAttribute('aria-controls', uniqueId);
  toggleButton.setAttribute('aria-expanded', 'false');
  toggleButton.setAttribute('title', 'Click to expand or collapse this test prompt');

  container.dataset.fileId = test.fileId;

  toggleButton.addEventListener('click', () => toggleTestContent(test, contentElement, toggleButton));
  runButton.addEventListener('click', (event) => {
    event.stopPropagation();
    runTest(test, container);
  });

  setStatus(container, '', 'info');

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
