const DEFAULT_STATE = {
    status: 'idle',

    tabId: null,

    targets: [],
    currentIndex: 0,

    currentPage: 1,
    nextPage: null,

    sent: 0,
    skipped: 0,
    failed: 0,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_AUTOMATION') {
        startAutomation(message.tabId);
    }

    if (message.type === 'STOP_AUTOMATION') {
        stopAutomation();
    }

    if (message.type === 'GET_STATE') {
        getState().then(sendResponse);

        return true;
    }

    if (message.type === 'TARGETS_FOUND') {
        const tabId = sender.tab?.id;

        if (!tabId) {
            console.error('[LCA] Sender tab id not found');
            return;
        }

        handleTargets(tabId, message.payload);
    }
    if (message.type === 'NEXT_PAGE_FOUND') {
        const tabId = sender.tab?.id;

        if (!tabId) {
            console.error('[LCA] Next page sender tab not found');
            return;
        }

        handleNextPageTarget(tabId, message.payload);
    }

    if (message.type === 'PAGE_DATA') {
        const tabId = sender.tab?.id;

        if (!tabId) {
            console.error('[LCA] Page sender tab not found');
            return;
        }

        handlePageData(tabId, message.payload);
    }
});

async function getState() {
    const result = await chrome.storage.local.get('automationState');

    console.log('[LCA] STORAGE RESULT:', result);

    return result?.automationState ?? DEFAULT_STATE;
}

async function setState(nextState) {
    await chrome.storage.local.set({
        automationState: nextState,
    });
}

async function startAutomation(tabId) {
    console.log('[LCA] RECEIVED TAB ID:', tabId);

    if (!tabId) {
        console.error('[LCA] Tab id is missing');
        return;
    }

    const state = await getState();

    if (state.status === 'running') {
        console.log('[LCA] Automation already running');
        return;
    }

    const nextState = {
        ...state,
        status: 'running',
        tabId,
    };

    await setState(nextState);

    console.log('[LCA] Automation started on tab:', tabId);

    try {
        await chrome.tabs.sendMessage(tabId, {
            type: 'START',
        });
    } catch (error) {
        console.error(
            '[LCA] Cannot start content script:',
            error
        );
    }
}

async function stopAutomation() {
    const state = await getState();

    await setState({
        ...state,
        status: 'stopped',
    });

    console.log('[LCA] Automation stopped');
}

async function handleTargets(tabId, targets) {
    const state = await getState();

    if (state.status !== 'running') {
        console.log('[LCA] Automation is not running');
        return;
    }

    if (!Array.isArray(targets)) {
        console.error('[LCA] Invalid targets payload');
        return;
    }

    const nextState = {
        ...state,
        tabId,
        targets,

        currentIndex:
            state.targets.length > 0
                ? state.currentIndex
                : 0,
    };

    await setState(nextState);

    console.log('[LCA] TARGETS STORED:', targets.length);

    if (targets.length > 0) {
        console.log('[LCA] FIRST TARGET:', targets[0]);
    }

    await processNextTarget();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processNextTarget() {
    const state = await getState();

    if (state.status !== 'running') {
        console.log('[LCA] Automation is not running');
        return;
    }

    const target = state.targets[state.currentIndex];

    if (!target) {
        console.log('[LCA] No more targets on current page');

        if (state.nextPage) {
            console.log('[LCA] NEXT PAGE AVAILABLE:', state.nextPage);

            await setState({
                ...state,
                status: 'waiting_next_page',
            });

            return;
        }

        console.log('[LCA] No next page. Run finished.');

        await setState({
            ...state,
            status: 'stopped',
        });

        return;
    }

    console.log('[LCA] PROCESSING:', {
        index: state.currentIndex,
        name: target.name,
    });

    const result = 'skipped';

    await applyTargetResult(result);

    console.log('[LCA] RESULT:', {
        name: target.name,
        result,
    });

    await sleep(1200);

    await processNextTarget();
}

async function applyTargetResult(result) {
    const state = await getState();

    const nextState = {
        ...state,
        currentIndex: state.currentIndex + 1,
    };

    if (result === 'sent') {
        nextState.sent = state.sent + 1;
    }

    if (result === 'skipped') {
        nextState.skipped = state.skipped + 1;
    }

    if (result === 'failed') {
        nextState.failed = state.failed + 1;
    }

    await setState(nextState);
}

async function handleNextPageTarget(tabId, target) {
    console.log('[LCA] NEXT PAGE MESSAGE RECEIVED:', {
        tabId,
        target,
    });

    const state = await getState();

    if (state.status !== 'running') {
        console.log(
            '[LCA] NEXT PAGE SKIPPED: automation is not running'
        );
        return;
    }

    await setState({
        ...state,
        nextPage: target,
    });

    console.log('[LCA] NEXT PAGE STORED:', target);
}

async function handlePageData(tabId, pageData) {
    const state = await getState();

    if (state.status !== 'running') {
        console.log('[LCA] Automation is not running');
        return;
    }

    const {
        targets,
        currentPage,
        nextPage,
    } = pageData;

    const nextState = {
        ...state,

        tabId,

        targets,
        currentIndex: 0,

        currentPage,
        nextPage,
    };

    await setState(nextState);

    console.log('[LCA] PAGE STORED:', {
        currentPage,
        targets: targets.length,
        hasNext: Boolean(nextPage),
    });

    await processNextTarget();
}