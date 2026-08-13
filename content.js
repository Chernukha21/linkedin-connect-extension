console.log('[LCA] CONTENT SCRIPT LOADED');

chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'START') {
        return;
    }

    handleStart();
});

async function handleStart() {
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

    const targets = await collectTargetsWithScroll();

    console.log('[LCA] FINAL TARGETS:', targets);

    const currentPage = getCurrentPageNumber();
    const nextButton = getNextPageButton();

    let nextPage = null;

    if (nextButton) {
        const rect = nextButton.getBoundingClientRect();

        nextPage = {
            type: 'NEXT_PAGE',
            currentPage,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    }

    console.log('[LCA] PAGE DATA:', {
        targets,
        currentPage,
        nextPage,
    });

    chrome.runtime.sendMessage({
        type: 'PAGE_DATA',
        payload: {
            targets,
            currentPage,
            nextPage,
        },
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

async function collectTargetsWithScroll() {
    const collected = new Map();

    let unchangedPasses = 0;
    const maxUnchangedPasses = 3;

    while (unchangedPasses < maxUnchangedPasses) {
        const targets = collectVisibleTargets();

        const sizeBefore = collected.size;

        for (const target of targets) {
            const key = getTargetKey(target);

            if (!collected.has(key)) {
                collected.set(key, target);
            }
        }

        const sizeAfter = collected.size;

        console.log('[LCA] COLLECT PASS:', {
            visible: targets.length,
            total: sizeAfter,
        });

        console.log('[LCA] BEFORE SCROLL');

        window.scrollBy({
            top: window.innerHeight * 0.8,
            behavior: 'smooth',
        });

        console.log('[LCA] AFTER SCROLL');

        await sleep(1200);

        console.log('[LCA] AFTER SLEEP');

        if (sizeAfter === sizeBefore) {
            unchangedPasses += 1;
        } else {
            unchangedPasses = 0;
        }

        window.scrollBy({
            top: window.innerHeight * 0.8,
            behavior: 'smooth',
        });

        await sleep(1200);
    }

    return [...collected.values()];
}

function collectVisibleTargets() {
    const actionElements = [
        ...document.querySelectorAll(`
            a[aria-label],
            button[aria-label],
            a[href*="/messaging/compose/"]
        `),
    ];

    return actionElements
        .map(createTarget)
        .filter(Boolean);
}

function getTargetKey(target) {
    return [
        target.type,
        target.href ?? '',
        target.label ?? '',
    ].join('|');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getCurrentPageNumber() {
    const currentPageButton = document.querySelector(
        'button[aria-current="true"][aria-label^="Page "]'
    );

    if (!currentPageButton) {
        return null;
    }

    const label = currentPageButton.getAttribute('aria-label');

    return Number(
        label.replace('Page ', '')
    );
}

function getNextPageButton() {
    return document.querySelector(
        '[data-testid="pagination-controls-next-button-visible"]'
    );
}

function sendNextPageTarget(nextButton, currentPage) {
    const rect = nextButton.getBoundingClientRect();

    const target = {
        type: 'NEXT_PAGE',
        currentPage,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };

    console.log('[LCA] NEXT PAGE TARGET:', target);

    chrome.runtime.sendMessage({
        type: 'NEXT_PAGE_FOUND',
        payload: target,
    });
}