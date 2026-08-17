const LOG_STORAGE_KEY = 'automationLog';
const MAX_LOG_ENTRIES = 30;

export async function addLogEvent(message, level = 'info') {
  const result = await chrome.storage.local.get(LOG_STORAGE_KEY);

  const currentLog = result[LOG_STORAGE_KEY] ?? [];

  const entry = {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    level,
    message,
  };

  const nextLog = [...currentLog, entry].slice(-MAX_LOG_ENTRIES);

  await chrome.storage.local.set({
    [LOG_STORAGE_KEY]: nextLog,
  });

  return entry;
}

export async function getLogEvents() {
  const result = await chrome.storage.local.get(LOG_STORAGE_KEY);

  return result[LOG_STORAGE_KEY] ?? [];
}

export async function clearLogEvents() {
  await chrome.storage.local.set({
    [LOG_STORAGE_KEY]: [],
  });
}
