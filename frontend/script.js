const messagesContainer = document.getElementById('messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('message');
const sendButton = document.getElementById('send-btn');
const template = document.getElementById('message-template');

const messageHistory = [];
let hasMessages = false;

function clearEmptyState() {
  if (!hasMessages) {
    messagesContainer.innerHTML = '';
  }
}

function appendMessage(role, content) {
  clearEmptyState();
  const messageNode = template.content.cloneNode(true);
  const wrapper = messageNode.querySelector('.message');
  wrapper.classList.add(role);
  messageNode.querySelector('.message-meta').textContent = role === 'user' ? 'You' : 'ChatGPT';
  messageNode.querySelector('.message-content').textContent = content;
  messagesContainer.appendChild(messageNode);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  hasMessages = true;
}

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
  input.disabled = isLoading;
  if (!isLoading) {
    input.focus();
  }
}

function showEmptyState() {
  if (!hasMessages) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Start the conversation by typing a message above.';
    messagesContainer.appendChild(empty);
  }
}

async function callApi(url, text) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: text,
      history: messageHistory
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return response.json();
}

async function sendMessage(text) {
  const base = window.location.origin.startsWith('file:')
    ? null
    : window.location.origin.replace(/\/$/, '');
  const fallbackEndpoint = 'http://localhost:3001';
  const attemptedUrls = new Set();

  const targets = [];
  if (base) {
    targets.push(`${base}/api/chat`);
  }
  targets.push(`${fallbackEndpoint}/api/chat`);

  for (const url of targets) {
    if (attemptedUrls.has(url)) {
      continue;
    }
    attemptedUrls.add(url);
    try {
      return await callApi(url, text);
    } catch (error) {
      if (url === targets[targets.length - 1]) {
        throw error;
      }
      console.warn(`Attempt to reach ${url} failed. Trying fallback...`, error);
    }
  }

  throw new Error('Unable to reach the chat backend.');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) {
    return;
  }

  setLoading(true);
  appendMessage('user', text);
  messageHistory.push({ role: 'user', content: text });
  input.value = '';

  try {
    const { reply } = await sendMessage(text);
    if (!reply) {
      throw new Error('Received empty response from the model.');
    }

    appendMessage('assistant', reply);
    messageHistory.push({ role: 'assistant', content: reply });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    appendMessage('assistant', `⚠️ Unable to contact ChatGPT. ${errorMessage}`);
    console.error('Chat request failed:', error);
  } finally {
    setLoading(false);
  }
});

showEmptyState();
