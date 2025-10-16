const fileInput = document.getElementById('file-input');
const uploadedFilesContainer = document.getElementById('uploaded-files');
const messageForm = document.getElementById('message-form');
const urlInput = document.getElementById('url-input');
const messageInput = document.getElementById('message-input');
const testsList = document.getElementById('tests-list');
const activityLog = document.getElementById('activity-log');
const testTemplate = document.getElementById('test-item-template');

const uploadedFiles = [];

function addLogEntry(title, body, variant = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${variant}`;

  const heading = document.createElement('h4');
  heading.textContent = title;
  entry.appendChild(heading);

  if (body) {
    const paragraph = document.createElement('p');
    paragraph.textContent = body;
    entry.appendChild(paragraph);
  }

  activityLog.prepend(entry);
}

function renderUploadedFiles() {
  if (uploadedFiles.length === 0) {
    uploadedFilesContainer.textContent = 'No files uploaded yet.';
    return;
  }

  const list = document.createElement('ul');
  list.className = 'file-list';
  uploadedFiles.forEach((file) => {
    const item = document.createElement('li');
    item.textContent = file.originalName || file.fileId;
    list.appendChild(item);
  });

  uploadedFilesContainer.innerHTML = '';
  uploadedFilesContainer.appendChild(list);
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    uploadedFiles.push({
      fileId: data.fileId,
      originalName: file.name
    });
    renderUploadedFiles();
    addLogEntry('File uploaded', `${file.name} is ready to use.`, 'success');
  } catch (error) {
    console.error('File upload failed', error);
    addLogEntry('Upload failed', `${file.name}: ${error.message}`, 'error');
  }
}

async function handleFileSelection(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  addLogEntry('Uploading files', `Preparing ${files.length} file(s)...`);
  for (const file of files) {
    await uploadFile(file);
  }
  fileInput.value = '';
}

function createTestElement(test) {
  const fragment = testTemplate.content.cloneNode(true);
  const container = fragment.querySelector('.test-item');
  const title = fragment.querySelector('.test-title');
  const preview = fragment.querySelector('.test-preview');
  const button = fragment.querySelector('.run-button');

  title.textContent = test.title;
  preview.textContent = test.preview || 'No preview available.';
  button.addEventListener('click', () => runTest(test));

  return container;
}

function renderTests(tests) {
  testsList.innerHTML = '';
  if (!tests || tests.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No tests stored yet. Generate one to get started!';
    testsList.appendChild(empty);
    return;
  }

  tests.forEach((test) => {
    testsList.appendChild(createTestElement(test));
  });
}

async function fetchTests() {
  try {
    const response = await fetch('/api/tests');
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }
    const tests = await response.json();
    renderTests(tests);
  } catch (error) {
    console.error('Failed to load tests', error);
    addLogEntry('Failed to load tests', error.message, 'error');
  }
}

async function runTest(test) {
  addLogEntry('Running test', test.title || test.fileId);
  try {
    const response = await fetch(`/api/tests/${encodeURIComponent(test.fileId)}/run`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error(`Run failed with status ${response.status}`);
    }
    const data = await response.json();
    addLogEntry(`Result for ${test.title || test.fileId}`, data.result || 'No response received.');
  } catch (error) {
    console.error('Failed to run test', error);
    addLogEntry('Failed to run test', error.message, 'error');
  }
}

async function submitMessage(event) {
  event.preventDefault();
  const url = urlInput.value.trim();
  const text = messageInput.value.trim();
  if (!url) {
    addLogEntry('URL required', 'Please enter a website URL before sending.', 'error');
    return;
  }

  const submitButton = messageForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  addLogEntry('Sending message', 'Dispatching request to the AI...');

  try {
    const response = await fetch('/api/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        message: text,
        files: uploadedFiles
      })
    });

    if (!response.ok) {
      throw new Error(`Message failed with status ${response.status}`);
    }

    const data = await response.json();
    addLogEntry('AI Response', data.response || 'No response content.');

    if (data.savedTest) {
      addLogEntry('Test saved', `${data.savedTest.title} added to the library.`, 'success');
      prependTest(data.savedTest);
    }

    messageInput.value = '';
  } catch (error) {
    console.error('Failed to send message', error);
    addLogEntry('Failed to send message', error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
}

function prependTest(test) {
  const existing = testsList.querySelectorAll('.test-item');
  const element = createTestElement(test);
  if (existing.length === 0) {
    testsList.innerHTML = '';
    testsList.appendChild(element);
  } else {
    testsList.prepend(element);
  }
}

fileInput.addEventListener('change', handleFileSelection);
messageForm.addEventListener('submit', submitMessage);

renderUploadedFiles();
fetchTests();
