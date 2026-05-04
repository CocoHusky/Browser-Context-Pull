const outputEl = document.getElementById('tab-output');
const statusEl = document.getElementById('status');
const filterGoogleSearchEl = document.getElementById('filter-google-search');
const filterNonHttpEl = document.getElementById('filter-non-http');
const filterDuplicatesEl = document.getElementById('filter-duplicates');
const contextTextEl = document.getElementById('context-text');
const CONTEXT_STORAGE_KEY = 'exportContextText';

let lastMode = null;
let saveContextTimeout = null;

document.getElementById('export-current-tab').addEventListener('click', () => exportTabs('currentTab'));
document.getElementById('export-current-window').addEventListener('click', () => exportTabs('currentWindow'));
document.getElementById('export-all-windows').addEventListener('click', () => exportTabs('allWindows'));
document.getElementById('copy-output').addEventListener('click', copyOutput);
document.getElementById('download-md-output').addEventListener('click', () => downloadOutput('md'));
document.getElementById('download-txt-output').addEventListener('click', () => downloadOutput('txt'));
[filterGoogleSearchEl, filterNonHttpEl, filterDuplicatesEl].forEach((filterEl) => {
  filterEl.addEventListener('change', () => {
    if (lastMode) {
      exportTabs(lastMode);
    }
  });
});
contextTextEl.addEventListener('input', () => {
  window.clearTimeout(saveContextTimeout);
  saveContextTimeout = window.setTimeout(saveContextText, 250);

  if (lastMode) {
    exportTabs(lastMode);
  }
});
contextTextEl.addEventListener('change', saveContextText);

loadContextText();

function setStatus(message) {
  statusEl.textContent = message;
}

function cleanValue(value, fallback) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function getFilters() {
  return {
    removeGoogleSearch: filterGoogleSearchEl.checked,
    removeNonHttp: filterNonHttpEl.checked,
    removeDuplicates: filterDuplicatesEl.checked
  };
}

async function loadContextText() {
  try {
    const result = await chrome.storage.local.get(CONTEXT_STORAGE_KEY);
    contextTextEl.value = result[CONTEXT_STORAGE_KEY] || '';
  } catch (error) {
    setStatus(`Context load failed: ${error && error.message ? error.message : 'Unknown error'}`);
  }
}

async function saveContextText() {
  try {
    await chrome.storage.local.set({ [CONTEXT_STORAGE_KEY]: contextTextEl.value });
  } catch (error) {
    setStatus(`Context save failed: ${error && error.message ? error.message : 'Unknown error'}`);
  }
}

function addContextToLines(lines) {
  const contextText = contextTextEl.value.trim();
  return contextText && lines.length ? [contextText, '', ...lines] : lines;
}

function isGoogleSearchTab(tab) {
  const title = cleanValue(tab.title, '');
  const url = cleanValue(tab.url, '');

  if (title.includes(' - Google Search')) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return hostname === 'google.com' || hostname.endsWith('.google.com') ? parsedUrl.pathname === '/search' : false;
  } catch (error) {
    return false;
  }
}

function isHttpUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

function applyFilters(tabs, filters, filterState = { seenUrls: new Set() }) {
  const keptTabs = [];
  let removedTabs = 0;

  tabs.forEach((tab) => {
    const url = cleanValue(tab.url, '');

    if (filters.removeGoogleSearch && isGoogleSearchTab(tab)) {
      removedTabs += 1;
      return;
    }

    if (filters.removeNonHttp && !isHttpUrl(url)) {
      removedTabs += 1;
      return;
    }

    if (filters.removeDuplicates) {
      const duplicateKey = url.toLowerCase();
      if (filterState.seenUrls.has(duplicateKey)) {
        removedTabs += 1;
        return;
      }
      filterState.seenUrls.add(duplicateKey);
    }

    keptTabs.push(tab);
  });

  return { tabs: keptTabs, removedTabs };
}

function formatCurrentTab(tab) {
  return `${cleanValue(tab.title, 'Untitled tab')} - ${cleanValue(tab.url, 'No URL')}`;
}

function getWindowLabel(index) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let label = '';
  let currentIndex = index;

  do {
    label = alphabet[currentIndex % alphabet.length] + label;
    currentIndex = Math.floor(currentIndex / alphabet.length) - 1;
  } while (currentIndex >= 0);

  return label;
}

function formatWindowSection(windowLabel, tabs) {
  const lines = [`Window [${windowLabel}]:`];

  tabs.forEach((tab, tabIndex) => {
    lines.push(`[${windowLabel}${tabIndex + 1}] - ${cleanValue(tab.title, 'Untitled tab')} - ${cleanValue(tab.url, 'No URL')}`);
  });

  return lines;
}

async function getOutputForMode(mode) {
  const filters = getFilters();
  let tabs = [];

  if (mode === 'currentTab') {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const filtered = applyFilters(tabs, filters);
    return {
      lines: filtered.tabs.map(formatCurrentTab),
      shownTabs: filtered.tabs.length,
      removedTabs: filtered.removedTabs
    };
  }

  if (mode === 'currentWindow') {
    tabs = await chrome.tabs.query({ currentWindow: true });
    const filtered = applyFilters(tabs.sort((a, b) => a.index - b.index), filters);
    const lines = filtered.tabs.length
      ? buildWindowSummary([{ label: 'a', tabCount: filtered.tabs.length }]).concat('', formatWindowSection('a', filtered.tabs))
      : [];
    return {
      lines,
      shownTabs: filtered.tabs.length,
      removedTabs: filtered.removedTabs
    };
  }

  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  let removedTabs = 0;
  const filterState = { seenUrls: new Set() };
  const sections = [];
  const windowSummaries = [];

  windows.forEach((browserWindow, windowIndex) => {
    const windowLabel = getWindowLabel(windowIndex);
    const windowTabs = (browserWindow.tabs || []).sort((a, b) => a.index - b.index);
    const filtered = applyFilters(windowTabs, filters, filterState);
    removedTabs += filtered.removedTabs;

    if (filtered.tabs.length) {
      windowSummaries.push({ label: windowLabel, tabCount: filtered.tabs.length });
      sections.push(formatWindowSection(windowLabel, filtered.tabs));
    }
  });

  const lines = sections.length
    ? buildWindowSummary(windowSummaries).concat('', sections.flatMap((section) => section.concat('')))
    : [];
  const shownTabs = windowSummaries.reduce((sum, summary) => sum + summary.tabCount, 0);

  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  return { lines, shownTabs, removedTabs };
}

function buildWindowSummary(windowSummaries) {
  const totalWindows = windowSummaries.length;
  const totalTabs = windowSummaries.reduce((sum, summary) => sum + summary.tabCount, 0);
  const windowText = totalWindows === 1 ? 'Window' : 'Windows';
  const tabText = totalTabs === 1 ? 'Tab' : 'Tabs';
  const lines = [`Total ${totalWindows} ${windowText} | ${totalTabs} ${tabText}:`];

  windowSummaries.forEach((summary) => {
    const tabText = summary.tabCount === 1 ? 'tab' : 'tabs';
    lines.push(`Window [${summary.label}] - ${summary.tabCount} ${tabText}`);
  });

  return lines;
}

async function exportTabs(mode) {
  try {
    lastMode = mode;
    setStatus('Getting tabs...');
    const { lines, shownTabs, removedTabs } = await getOutputForMode(mode);
    outputEl.value = addContextToLines(lines).join('\n');
    const removedText = removedTabs ? ` ${removedTabs} filtered out.` : '';
    setStatus(shownTabs ? `Ready. ${shownTabs} tab${shownTabs === 1 ? '' : 's'} shown.${removedText}` : `No tabs shown.${removedText}`);
  } catch (error) {
    setStatus(`Export failed: ${error && error.message ? error.message : 'Unknown error'}`);
  }
}

async function copyOutput() {
  const output = outputEl.value.trim();
  if (!output) {
    setStatus('Nothing to copy yet.');
    return;
  }

  try {
    await navigator.clipboard.writeText(output);
    setStatus('Copied to clipboard.');
  } catch (error) {
    setStatus(`Copy failed: ${error && error.message ? error.message : 'Unknown error'}`);
  }
}

function downloadOutput(fileType) {
  const output = outputEl.value.trim();
  if (!output) {
    setStatus('Nothing to download yet.');
    return;
  }

  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const extension = fileType === 'md' ? 'md' : 'txt';
  const filename = `tabs-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${extension}`;
  const mimeType = fileType === 'md' ? 'text/markdown' : 'text/plain';

  const blob = new Blob([output], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  setStatus(`Downloaded ${filename}.`);
}
