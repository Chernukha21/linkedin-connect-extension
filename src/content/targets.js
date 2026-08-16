globalThis.LCA = globalThis.LCA ?? {};

LCA.createTarget = function createTarget(element) {
  const type = LCA.resolveAction(element);

  if (!type) {
    return null;
  }

  const rect = element.getBoundingClientRect();

  const ariaLabel = element.getAttribute('aria-label')?.trim() ?? '';

  return {
    type,
    name: LCA.extractName(type, ariaLabel),
    label: ariaLabel,
    href: element.getAttribute('href'),
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

LCA.collectVisibleTargets = function collectVisibleTargets() {
  const actionElements = [
    ...document.querySelectorAll(`
      a[aria-label],
      button[aria-label],
      a[href*="/messaging/compose/"]
    `),
  ];

  return actionElements.map(LCA.createTarget).filter(Boolean);
};

LCA.getTargetKey = function getTargetKey(target) {
  return [target.type, target.href ?? '', target.label ?? ''].join('|');
};

LCA.collectTargetsWithScroll = async function collectTargetsWithScroll() {
  const collected = new Map();

  let unchangedPasses = 0;
  const maxUnchangedPasses = 3;

  while (unchangedPasses < maxUnchangedPasses) {
    const targets = LCA.collectVisibleTargets();

    const sizeBefore = collected.size;

    for (const target of targets) {
      const key = LCA.getTargetKey(target);

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

    await LCA.sleep(1200);

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

    await LCA.sleep(1200);
  }

  return [...collected.values()];
};

LCA.findTargetElement = function findTargetElement(target) {
  const actionElements = [
    ...document.querySelectorAll(`
      a[aria-label],
      button[aria-label],
      a[href*="/messaging/compose/"]
    `),
  ];

  return (
    actionElements.find((element) => {
      const type = LCA.resolveAction(element);

      if (type !== target.type) {
        return false;
      }

      const ariaLabel = element.getAttribute('aria-label')?.trim() ?? '';
      const href = element.getAttribute('href') ?? null;

      if (target.label && ariaLabel === target.label) {
        return true;
      }

      if (target.href && href === target.href) {
        return true;
      }

      return false;
    }) ?? null
  );
};

LCA.resolveTargetPosition = async function resolveTargetPosition(target) {
  let element = LCA.findTargetElement(target);

  if (!element) {
    console.log('[LCA] TARGET NOT CURRENTLY VISIBLE:', {
      name: target.name,
      type: target.type,
    });

    return null;
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  await LCA.sleep(500);

  element = LCA.findTargetElement(target);

  if (!element) {
    console.log('[LCA] TARGET DISAPPEARED AFTER SCROLL:', {
      name: target.name,
      type: target.type,
    });

    return null;
  }

  const rect = element.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.bottom < 0 ||
    rect.top > window.innerHeight
  ) {
    console.log('[LCA] TARGET IS OUTSIDE VIEWPORT:', {
      name: target.name,
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
    });

    return null;
  }

  const position = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };

  console.log('[LCA] TARGET POSITION RESOLVED:', {
    name: target.name,
    ...position,
  });

  return position;
};

LCA.findOverflowConnectElement = function findOverflowConnectElement() {
  const candidates = [
    ...document.querySelectorAll(
      '[role="menuitem"], [role="menu"] button, [role="menu"] a'
    ),
  ];

  return (
    candidates.find((element) => {
      const rect = element.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }

      const text = element.textContent?.trim() ?? '';
      const ariaLabel = element.getAttribute('aria-label')?.trim() ?? '';

      return (
        text === 'Connect' ||
        ariaLabel === 'Connect' ||
        ariaLabel.toLowerCase().includes('connect')
      );
    }) ?? null
  );
};

LCA.resolveOverflowConnectPosition = function resolveOverflowConnectPosition() {
  const element = LCA.findOverflowConnectElement();

  if (!element) {
    console.log('[LCA] OVERFLOW CONNECT NOT FOUND');
    return null;
  }

  const rect = element.getBoundingClientRect();

  const position = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };

  console.log('[LCA] OVERFLOW CONNECT POSITION:', position);

  return position;
};
