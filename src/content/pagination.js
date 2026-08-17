globalThis.LCA = globalThis.LCA ?? {};

LCA.pageChangeObserver = LCA.pageChangeObserver ?? null;

LCA.getCurrentPageNumber = function getCurrentPageNumber() {
  const currentPageButton = document.querySelector(
    'button[aria-current="true"]'
  );

  if (!currentPageButton) {
    return null;
  }

  const text = currentPageButton.textContent?.trim() ?? '';

  const label = currentPageButton.getAttribute('aria-label') ?? '';

  // Prefer the visible numeric page value.
  // Fall back to aria-label if necessary.
  const match = text.match(/\d+/) ?? label.match(/\d+/);

  if (!match) {
    return null;
  }

  const page = Number(match[0]);

  return Number.isFinite(page) ? page : null;
};

LCA.getNextPageButton = function getNextPageButton() {
  const candidates = [...document.querySelectorAll('button')];

  return (
    candidates.find((button) => {
      const testId = button.getAttribute('data-testid') ?? '';

      const text = button.textContent?.trim() ?? '';

      const rect = button.getBoundingClientRect();

      const isNext =
        testId.startsWith('pagination-controls-next-button') || text === 'Next';

      const isVisible = rect.width > 0 && rect.height > 0;

      return isNext && !button.disabled && isVisible;
    }) ?? null
  );
};

LCA.createNextPageTarget = function createNextPageTarget(
  nextButton,
  currentPage
) {
  if (!nextButton) {
    return null;
  }

  const rect = nextButton.getBoundingClientRect();

  return {
    type: 'NEXT_PAGE',
    currentPage,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

LCA.disconnectPageChangeObserver = function disconnectPageChangeObserver() {
  if (!LCA.pageChangeObserver) {
    return;
  }

  LCA.pageChangeObserver.disconnect();
  LCA.pageChangeObserver = null;
};

LCA.waitForPageChange = function waitForPageChange(previousPage) {
  // Only one page-change observer may exist
  // at a time. This prevents Pause → Resume
  // from creating duplicate observers.
  LCA.disconnectPageChangeObserver();

  const observer = new MutationObserver(() => {
    const currentPage = LCA.getCurrentPageNumber();

    if (!currentPage || currentPage === previousPage) {
      return;
    }

    console.log('[LCA] PAGE CHANGED:', {
      from: previousPage,
      to: currentPage,
    });

    observer.disconnect();

    if (LCA.pageChangeObserver === observer) {
      LCA.pageChangeObserver = null;
    }

    LCA.handleStart().catch((error) => {
      console.error('[LCA] PAGE CHANGE HANDLER FAILED:', error);
    });
  });

  LCA.pageChangeObserver = observer;

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[LCA] WAITING FOR PAGE CHANGE FROM:', previousPage);
};

LCA.resolveNextPagePosition = async function resolveNextPagePosition(
  timeout = 3000
) {
  let nextButton = LCA.getNextPageButton();

  if (!nextButton) {
    console.log('[LCA] NEXT PAGE BUTTON NOT FOUND');

    return null;
  }

  const getVisiblePosition = (button) => {
    const rect = button.getBoundingClientRect();

    const isVisible =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;

    if (!isVisible) {
      return null;
    }

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  // Target collection usually leaves pagination
  // visible, so try the current position first.
  const currentPosition = getVisiblePosition(nextButton);

  if (currentPosition) {
    return currentPosition;
  }

  nextButton.scrollIntoView({
    behavior: 'auto',
    block: 'center',
  });

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    await LCA.sleep(100);

    nextButton = LCA.getNextPageButton();

    if (!nextButton) {
      console.log('[LCA] NEXT PAGE BUTTON DISAPPEARED');

      return null;
    }

    const position = getVisiblePosition(nextButton);

    if (position) {
      return position;
    }
  }

  console.log('[LCA] NEXT PAGE BUTTON DID NOT ENTER VIEWPORT');

  return null;
};
