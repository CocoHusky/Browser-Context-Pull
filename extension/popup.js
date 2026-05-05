const outputEl = document.getElementById('tab-output');
const statusEl = document.getElementById('status');
const filterGoogleSearchEl = document.getElementById('filter-google-search');
const filterNonHttpEl = document.getElementById('filter-non-http');
const filterDuplicatesEl = document.getElementById('filter-duplicates');
const contextTextEl = document.getElementById('context-text');
const CONTEXT_STORAGE_KEY = 'exportContextText';

let lastMode = null;
let saveContextTimeout = null;
let jsonOutput = null;

document.getElementById('export-current-tab').addEventListener('click', () => exportTabs('currentTab'));
document.getElementById('export-current-window').addEventListener('click', () => exportTabs('currentWindow'));
document.getElementById('export-all-windows').addEventListener('click', () => exportTabs('allWindows'));
document.getElementById('copy-output').addEventListener('click', copyOutput);
document.getElementById('download-md-output').addEventListener('click', () => downloadOutput('md'));
document.getElementById('download-json-output').addEventListener('click', () => downloadOutput('json'));
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
  return `- [${cleanValue(tab.title, 'Untitled tab')}](${cleanValue(tab.url, 'No URL')})`;
}

function getWindowLabel(index) {
  return (index + 1).toString();
}

function formatWindowSection(windowNumber, tabs) {
  const lines = [`## Window ${windowNumber}`];

  tabs.forEach((tab) => {
    lines.push(`- [${cleanValue(tab.title, 'Untitled tab')}](${cleanValue(tab.url, 'No URL')})`);
  });

  return lines;
}

async function getOutputForMode(mode) {
  const filters = getFilters();
  let tabs = [];

  if (mode === 'currentTab') {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const filtered = applyFilters(tabs, filters);
    const markdownLines = filtered.tabs.map(formatCurrentTab);
    const jsonObject = {
      "browser": "Chrome",
      "window_count": 1,
      "tab_count": filtered.tabs.length,
      "windows": [
        {
          "window_id": 1,
          "tab_count": filtered.tabs.length,
          "tabs": filtered.tabs.map((tab, index) => ({
            "position": index + 1,
            "title": cleanValue(tab.title, 'Untitled tab'),
            "url": cleanValue(tab.url, 'No URL')
          }))
        }
      ]
    };
    return { markdownLines, jsonObject, shownTabs: filtered.tabs.length, removedTabs: filtered.removedTabs };
  }

  if (mode === 'currentWindow') {
    tabs = await chrome.tabs.query({ currentWindow: true });
    const filtered = applyFilters(tabs.sort((a, b) => a.index - b.index), filters);
    const markdownLines = [`## Window 1`].concat(filtered.tabs.map(formatCurrentTab));
    const jsonObject = {
      "browser": "Chrome",
      "window_count": 1,
      "tab_count": filtered.tabs.length,
      "windows": [
        {
          "window_id": 1,
          "tab_count": filtered.tabs.length,
          "tabs": filtered.tabs.map((tab, index) => ({
            "position": index + 1,
            "title": cleanValue(tab.title, 'Untitled tab'),
            "url": cleanValue(tab.url, 'No URL')
          }))
        }
      ]
    };
    return { markdownLines, jsonObject, shownTabs: filtered.tabs.length, removedTabs: filtered.removedTabs };
  }

  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  let removedTabs = 0;
  const filterState = { seenUrls: new Set() };
  const markdownSections = [];
  const jsonWindows = [];
  let totalTabs = 0;

  windows.forEach((browserWindow, windowIndex) => {
    const windowNumber = windowIndex + 1;
    const windowTabs = (browserWindow.tabs || []).sort((a, b) => a.index - b.index);
    const filtered = applyFilters(windowTabs, filters, filterState);
    removedTabs += filtered.removedTabs;

    if (filtered.tabs.length) {
      markdownSections.push(formatWindowSection(windowNumber, filtered.tabs));
      jsonWindows.push({
        "window_id": windowNumber,
        "tab_count": filtered.tabs.length,
        "tabs": filtered.tabs.map((tab, index) => ({
          "position": index + 1,
          "title": cleanValue(tab.title, 'Untitled tab'),
          "url": cleanValue(tab.url, 'No URL')
        }))
      });
      totalTabs += filtered.tabs.length;
    }
  });

  const markdownLines = markdownSections.flatMap(section => section.concat([''])).slice(0, -1);
  const jsonObject = {
    "browser": "Chrome",
    "window_count": jsonWindows.length,
    "tab_count": totalTabs,
    "windows": jsonWindows
  };
  return { markdownLines, jsonObject, shownTabs: totalTabs, removedTabs };
}



async function exportTabs(mode) {
  try {
    lastMode = mode;
    setStatus('Getting tabs...');
    const { markdownLines, jsonObject, shownTabs, removedTabs } = await getOutputForMode(mode);
    const contextText = contextTextEl.value.trim();
    const finalMarkdownLines = contextText ? [contextText, '', ...markdownLines] : markdownLines;
    outputEl.value = finalMarkdownLines.join('\n');
    jsonOutput = contextText ? { ...jsonObject, "context": contextText } : jsonObject;
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
  let output;
  if (fileType === 'md') {
    output = outputEl.value.trim();
  } else if (fileType === 'json') {
    output = JSON.stringify(jsonOutput, null, 2);
  }
  if (!output) {
    setStatus('Nothing to download yet.');
    return;
  }

  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const extension = fileType === 'md' ? 'md' : 'json';
  const filename = `tabs-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${extension}`;
  const mimeType = fileType === 'md' ? 'text/markdown' : 'application/json';

  const blob = new Blob([output], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  setStatus(`Downloaded ${filename}.`);
}
