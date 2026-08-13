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

    const isPeopleSearch =
        window.location.pathname === '/search/results/people/';

    if (!isPeopleSearch) {
        console.log('[LCA] SKIP: not a people search page');

        chrome.runtime.sendMessage({
            type: 'INVALID_PAGE',
            payload: {
                url: window.location.href,
            },
        });

        return;
    }

    const actionElements = [
        ...document.querySelectorAll(`
            a[aria-label],
            button[aria-label],
            a[href*="/messaging/compose/"]
        `),
    ];

    console.log('[LCA] ACTION CANDIDATES:', actionElements.length);

    const targets = actionElements
        .map(createTarget)
        .filter(Boolean);

    console.log('[LCA] TARGETS:', targets);

    chrome.runtime.sendMessage({
        type: 'TARGETS_FOUND',
        payload: targets,
    });
}

function resolveAction(element) {
    const ariaLabel =
        element.getAttribute('aria-label')?.trim() ?? '';

    const href =
        element.getAttribute('href') ?? '';

    const text =
        element.textContent?.trim() ?? '';

    // CONNECT
    if (
        ariaLabel.startsWith('Invite ') &&
        ariaLabel.endsWith(' to connect')
    ) {
        return 'CONNECT';
    }

    // PENDING
    if (ariaLabel.startsWith('Pending,')) {
        return 'PENDING';
    }

    // MESSAGE
    if (
        href.includes('/messaging/compose/') ||
        text === 'Message'
    ) {
        return 'MESSAGE';
    }

    // FOLLOW
    if (
        ariaLabel.startsWith('Follow ') ||
        text === 'Follow'
    ) {
        return 'FOLLOW';
    }

    // MORE
    if (ariaLabel === 'More') {
        return 'MORE';
    }

    return null;
}

function createTarget(element) {
    const type = resolveAction(element);

    if (!type) {
        return null;
    }

    const rect = element.getBoundingClientRect();

    const ariaLabel =
        element.getAttribute('aria-label')?.trim() ?? '';

    return {
        type,
        name: extractName(type, ariaLabel),
        label: ariaLabel,
        href: element.getAttribute('href'),
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
}

function extractName(type, ariaLabel) {
    if (type === 'CONNECT') {
        return ariaLabel
            .replace(/^Invite\s+/, '')
            .replace(/\s+to connect$/, '');
    }

    if (type === 'PENDING') {
        return ariaLabel
            .replace(
                /^Pending,\s*click to withdraw invitation sent to\s+/,
                ''
            );
    }

    if (type === 'FOLLOW') {
        return ariaLabel
            .replace(/^Follow\s+/, '');
    }

    return null;
}