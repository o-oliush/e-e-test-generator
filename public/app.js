const fileInput = document.getElementById('file-input');
const uploadedFilesContainer = document.getElementById('uploaded-files');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const activityLog = document.getElementById('activity-log');

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

async function submitMessage(event) {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) {
    addLogEntry('Message required', 'Please enter a message before sending.', 'error');
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
      const label = data.savedTest.title || data.savedTest.fileId;
      addLogEntry('Test saved', `${label} added to the stored prompts library.`, 'success');
    }

    messageInput.value = '';
  } catch (error) {
    console.error('Failed to send message', error);
    addLogEntry('Failed to send message', error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
}

fileInput.addEventListener('change', handleFileSelection);
messageForm.addEventListener('submit', submitMessage);

renderUploadedFiles();
