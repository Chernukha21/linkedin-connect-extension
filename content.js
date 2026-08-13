console.log('[LCA] CONTENT SCRIPT LOADED');

chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'START') {
        return;
    }

    handleStart();
});

function handleStart() {
    console.log('[LCA] START RECEIVED');
    console.log('[LCA] URL:', window.location.href);

    const connectElements = [
        ...document.querySelectorAll(
            'a[aria-label^="Invite "][aria-label$=" to connect"]'
        ),
    ];

    console.log('[LCA] CONNECT FOUND:', connectElements.length);

    if (connectElements.length === 0) {
        console.log('[LCA] No Connect elements found');
        return;
    }

    const targets = connectElements.map(createConnectTarget);

    console.log('[LCA] TARGETS:', targets);

    chrome.runtime.sendMessage({
        type: 'TARGETS_FOUND',
        payload: targets,
    });
}

function createConnectTarget(element) {
    const rect = element.getBoundingClientRect();

    const label = element.getAttribute('aria-label') ?? '';

    const name = label
        .replace(/^Invite\s+/, '')
        .replace(/\s+to connect$/, '');

    return {
        type: 'CONNECT',
        name,
        label,
        href: element.getAttribute('href'),
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
}