globalThis.LCA = globalThis.LCA ?? {};

LCA.getOpenShadowRoots = function getOpenShadowRoots(root = document) {
  const roots = [];

  const visit = (currentRoot) => {
    const elements = currentRoot.querySelectorAll('*');

    for (const element of elements) {
      if (!element.shadowRoot) {
        continue;
      }

      roots.push(element.shadowRoot);

      visit(element.shadowRoot);
    }
  };

  visit(root);

  return roots;
};

LCA.getSearchRoots = function getSearchRoots() {
  return [document, ...LCA.getOpenShadowRoots()];
};

LCA.getElementCenter = function getElementCenter(element) {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,

    y: rect.top + rect.height / 2,
  };
};

LCA.isElementVisible = function isElementVisible(element) {
  const rect = element.getBoundingClientRect();

  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth &&
    style.display !== 'none' &&
    style.visibility !== 'hidden'
  );
};

LCA.getVisibleButtons = function getVisibleButtons(root) {
  return [...root.querySelectorAll('button, [role="button"]')].filter(
    LCA.isElementVisible
  );
};

LCA.findUnknownModalCandidate = function findUnknownModalCandidate(root) {
  if (!root) {
    return null;
  }

  const ignoredTags = new Set(['STYLE', 'SCRIPT', 'LINK', 'TEMPLATE']);

  const viewportCenterX = window.innerWidth / 2;

  const viewportCenterY = window.innerHeight / 2;

  const candidates = [...root.querySelectorAll('*')].filter((element) => {
    if (ignoredTags.has(element.tagName)) {
      return false;
    }

    if (!LCA.isElementVisible(element)) {
      return false;
    }

    const text = element.textContent?.trim() ?? '';

    if (!text) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    // Ignore small unrelated UI such as
    // LinkedIn's messaging bubble.
    if (rect.width < 300 || rect.height < 120) {
      return false;
    }

    const centerX = rect.left + rect.width / 2;

    const centerY = rect.top + rect.height / 2;

    const horizontalDistance = Math.abs(centerX - viewportCenterX);

    const verticalDistance = Math.abs(centerY - viewportCenterY);

    const horizontallyCentered = horizontalDistance < window.innerWidth * 0.3;

    const verticallyCentered = verticalDistance < window.innerHeight * 0.3;

    return horizontallyCentered && verticallyCentered;
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const aRect = a.getBoundingClientRect();

    const bRect = b.getBoundingClientRect();

    const aArea = aRect.width * aRect.height;

    const bArea = bRect.width * bRect.height;

    return bArea - aArea;
  });

  return candidates[0];
};

LCA.resolveModalState = function resolveModalState() {
  const roots = LCA.getSearchRoots();

  // Standard invitation modal:
  // "Send without a note".
  for (const root of roots) {
    const buttons = LCA.getVisibleButtons(root);

    const action = buttons.find((button) => {
      const text = button.textContent?.trim() ?? '';

      const ariaLabel = button.getAttribute('aria-label')?.trim() ?? '';

      return (
        text === 'Send without a note' || ariaLabel === 'Send without a note'
      );
    });

    if (action) {
      return {
        type: 'ADD_NOTE',

        action: LCA.getElementCenter(action),
      };
    }
  }

  // LinkedIn-side weekly limit.
  for (const root of roots) {
    const text = root.textContent?.trim() ?? '';

    if (text.includes("You've reached the weekly invitation limit")) {
      return {
        type: 'WEEKLY_LIMIT',
      };
    }
  }

  // LinkedIn may require additional
  // relationship / email verification.
  for (const root of roots) {
    const rootText = root.textContent?.trim() ?? '';

    if (!rootText.includes('How do you know')) {
      continue;
    }

    const buttons = LCA.getVisibleButtons(root);

    const closeButton = buttons.find((button) => {
      const buttonText = button.textContent?.trim().toLowerCase() ?? '';

      const ariaLabel =
        button.getAttribute('aria-label')?.trim().toLowerCase() ?? '';

      const value = `${ariaLabel} ${buttonText}`;

      return (
        value.includes('dismiss') ||
        value.includes('close') ||
        value.includes('cancel') ||
        value.includes('not now')
      );
    });

    return {
      type: 'EMAIL_VERIFICATION',

      action: closeButton ? LCA.getElementCenter(closeButton) : null,
    };
  }

  // Unknown modal fallback.
  //
  // LinkedIn currently renders invitation UI
  // inside #interop-outlet's open shadow root.
  // Looking for a centered visible element avoids
  // treating unrelated shadow-root content as a modal.
  const interopRoot =
    document.querySelector('#interop-outlet')?.shadowRoot ?? null;

  const unknownModal = LCA.findUnknownModalCandidate(interopRoot);

  if (unknownModal) {
    return {
      type: 'UNKNOWN',

      text: unknownModal.textContent?.trim() ?? '',

      dom: unknownModal.outerHTML,
    };
  }

  return {
    type: 'NONE',
  };
};
