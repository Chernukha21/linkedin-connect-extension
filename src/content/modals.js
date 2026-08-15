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

LCA.getVisibleButtons = function getVisibleButtons(root) {
  return [...root.querySelectorAll('button, [role="button"]')].filter(
    (button) => {
      const rect = button.getBoundingClientRect();

      return rect.width > 0 && rect.height > 0;
    }
  );
};

LCA.resolveModalState = function resolveModalState() {
  const roots = LCA.getSearchRoots();

  // Add note modal
  for (const root of roots) {
    const buttons = LCA.getVisibleButtons(root);

    const sendWithoutNoteButton = buttons.find((button) => {
      const text = button.textContent?.trim() ?? '';
      const ariaLabel = button.getAttribute('aria-label')?.trim() ?? '';

      return (
        text === 'Send without a note' || ariaLabel === 'Send without a note'
      );
    });

    if (sendWithoutNoteButton) {
      return {
        type: 'ADD_NOTE',
        action: LCA.getElementCenter(sendWithoutNoteButton),
      };
    }
  }

  // Weekly invitation limit
  for (const root of roots) {
    const text = root.textContent?.trim() ?? '';

    if (text.includes("You've reached the weekly invitation limit")) {
      return {
        type: 'WEEKLY_LIMIT',
      };
    }
  }

  // Email / relationship verification
  for (const root of roots) {
    const text = root.textContent?.trim() ?? '';

    if (!text.includes('How do you know')) {
      continue;
    }

    const buttons = LCA.getVisibleButtons(root);

    const closeButton = buttons.find((button) => {
      const text = button.textContent?.trim().toLowerCase() ?? '';
      const ariaLabel =
        button.getAttribute('aria-label')?.trim().toLowerCase() ?? '';

      const value = `${ariaLabel} ${text}`;

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

  const interopRoot =
    document.querySelector('#interop-outlet')?.shadowRoot ?? null;

  if (interopRoot) {
    const text = interopRoot.textContent?.trim() ?? '';

    if (text) {
      return {
        type: 'UNKNOWN',
        text,
        dom: interopRoot.innerHTML,
      };
    }
  }

  return {
    type: 'NONE',
  };
};

LCA.observeModals = function observeModals() {
  const observer = new MutationObserver(() => {
    const modalState = LCA.resolveModalState();

    if (modalState.type === 'NONE') {
      return;
    }

    console.log('[LCA] MODAL STATE:', modalState);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[LCA] MODAL OBSERVER STARTED');
};
