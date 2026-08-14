const startButton = document.querySelector('#startButton');
const stopButton = document.querySelector('#stopButton');
const statusElement = document.querySelector('#status');

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

async function renderState() {
    const state = await chrome.runtime.sendMessage({
        type: 'GET_STATE',
    });

    if (!state) {
        return;
    }

    statusElement.textContent = state.status;
}


chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
        return;
    }

    const change = changes.automationState;

    if (!change?.newValue) {
        return;
    }

    statusElement.textContent = change.newValue.status;
});

renderState();