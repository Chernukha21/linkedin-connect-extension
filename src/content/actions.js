globalThis.LCA = globalThis.LCA ?? {};

LCA.resolveAction = function resolveAction(element) {
  const ariaLabel = element.getAttribute('aria-label')?.trim() ?? '';

  const href = element.getAttribute('href') ?? '';

  const text = element.textContent?.trim() ?? '';

  if (ariaLabel.startsWith('Invite ') && ariaLabel.endsWith(' to connect')) {
    return 'CONNECT';
  }

  if (ariaLabel.startsWith('Pending,')) {
    return 'PENDING';
  }

  if (href.includes('/messaging/compose/') || text === 'Message') {
    return 'MESSAGE';
  }

  if (ariaLabel.startsWith('Follow ') || text === 'Follow') {
    return 'FOLLOW';
  }

  if (ariaLabel === 'More') {
    return 'MORE';
  }

  return null;
};

LCA.extractName = function extractName(type, ariaLabel) {
  if (type === 'CONNECT') {
    return ariaLabel.replace(/^Invite\s+/, '').replace(/\s+to connect$/, '');
  }

  if (type === 'PENDING') {
    return ariaLabel.replace(
      /^Pending,\s*click to withdraw invitation sent to\s+/,
      ''
    );
  }

  if (type === 'FOLLOW') {
    return ariaLabel.replace(/^Follow\s+/, '');
  }

  return null;
};
