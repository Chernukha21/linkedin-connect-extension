const startButton = document.querySelector('#startButton');
const stopButton = document.querySelector('#stopButton');

const statusElement = document.querySelector('#status');

const currentPageElement = document.querySelector('#currentPage');

const progressElement = document.querySelector('#progress');

const progressBarElement = document.querySelector('#progressBar');

const sentCountElement = document.querySelector('#sentCount');

const skippedCountElement = document.querySelector('#skippedCount');

const failedCountElement = document.querySelector('#failedCount');

const dailyRemainingElement = document.querySelector('#dailyRemaining');

const weeklyRemainingElement = document.querySelector('#weeklyRemaining');

const dailyLimitInput = document.querySelector('#dailyLimit');

const weeklyLimitInput = document.querySelector('#weeklyLimit');

const saveLimitsButton = document.querySelector('#saveLimitsButton');

const settingsMessage = document.querySelector('#settingsMessage');

const eventLogElement = document.querySelector('#eventLog');

const clearLogButton = document.querySelector('#clearLogButton');

startButton.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    console.error('[LCA] Active tab not found');
    return;
  }

  await chrome.runtime.sendMessage({
    type: 'START_AUTOMATION',
    tabId: tab.id,
  });

  await renderState();
});

stopButton.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({
    type: 'STOP_AUTOMATION',
  });

  await renderState();
});

saveLimitsButton.addEventListener('click', async () => {
  const daily = Number(dailyLimitInput.value);
  const weekly = Number(weeklyLimitInput.value);

  settingsMessage.className = 'message';
  settingsMessage.textContent = '';

  const response = await chrome.runtime.sendMessage({
    type: 'SET_RATE_LIMITS',
    daily,
    weekly,
  });

  if (!response?.ok) {
    settingsMessage.classList.add('error');

    settingsMessage.textContent = response?.error ?? 'Cannot save limits';

    return;
  }

  settingsMessage.classList.add('success');
  settingsMessage.textContent = 'Limits saved';

  await renderState();
});

clearLogButton.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({
    type: 'CLEAR_LOG',
  });

  await renderState();
});

async function getUiState() {
  return chrome.runtime.sendMessage({
    type: 'GET_UI_STATE',
  });
}

function renderControls(status) {
  const isActive = status === 'running' || status === 'waiting_next_page';

  const isPaused = status === 'paused';

  startButton.disabled = isActive;

  startButton.textContent = isPaused ? 'Resume' : 'Start';

  stopButton.disabled = !isActive;
}

function renderProgress(state) {
  const total = state.targets?.length ?? 0;

  const current = Math.min(state.currentIndex ?? 0, total);

  currentPageElement.textContent = state.currentPage ?? 1;

  progressElement.textContent = `${current} / ${total}`;

  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  progressBarElement.style.width = `${percentage}%`;
}

function renderCounters(state) {
  sentCountElement.textContent = state.sent ?? 0;

  skippedCountElement.textContent = state.skipped ?? 0;

  failedCountElement.textContent = state.failed ?? 0;
}

function renderRateLimits(state, rateStatus) {
  dailyRemainingElement.textContent = rateStatus?.dailyRemaining ?? '—';

  weeklyRemainingElement.textContent = rateStatus?.weeklyRemaining ?? '—';

  if (document.activeElement !== dailyLimitInput) {
    dailyLimitInput.value = state.rateLimits?.daily ?? 20;
  }

  if (document.activeElement !== weeklyLimitInput) {
    weeklyLimitInput.value = state.rateLimits?.weekly ?? 100;
  }
}

async function renderState() {
  try {
    const result = await getUiState();

    if (!result?.state) {
      return;
    }

    const { state, rateStatus, events } = result;

    statusElement.textContent = state.status;
    statusElement.dataset.status = state.status;

    renderControls(state.status);
    renderProgress(state);
    renderCounters(state);
    renderRateLimits(state, rateStatus);
    renderEvents(events);
  } catch (error) {
    console.error('[LCA] Cannot render popup state:', error);
  }
}

function renderEvents(events = []) {
  if (events.length === 0) {
    eventLogElement.innerHTML = `
      <div class="empty-log">
        No events yet
      </div>
    `;

    return;
  }

  const latestEvents = [...events].reverse().slice(0, 8);

  eventLogElement.replaceChildren();

  for (const event of latestEvents) {
    const row = document.createElement('div');

    row.className = 'event';
    row.dataset.level = event.level ?? 'info';

    const time = document.createElement('span');

    time.className = 'event-time';

    time.textContent = new Date(event.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const message = document.createElement('span');

    message.className = 'event-message';
    message.textContent = event.message;

    row.append(time, message);

    eventLogElement.append(row);
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (!changes.automationState && !changes.automationLog) {
    return;
  }

  renderState();
});

renderState();
