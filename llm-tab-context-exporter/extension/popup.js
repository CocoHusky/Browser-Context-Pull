const VERSION = '0.1.0';
const DEFAULT_MAX_CHARS = 12000;
const UNSUPPORTED_SCHEMES = ['chrome://', 'edge://', 'brave://', 'about:', 'file:', 'chrome-extension:', 'devtools:', 'view-source:'];

const outputEl = document.getElementById('markdown-output');
const statusEl = document.getElementById('status');

document.getElementById('export-current-tab').addEventListener('click', () => exportTabs('currentTab'));
document.getElementById('export-current-window').addEventListener('click', () => exportTabs('currentWindow'));
document.getElementById('export-all-windows').addEventListener('click', () => exportTabs('allWindows'));
document.getElementById('copy-markdown').addEventListener('click', copyMarkdown);
document.getElementById('download-markdown').addEventListener('click', downloadMarkdown);

function setStatus(message) {
  statusEl.textContent = message;
}

function getExportOptions() {
  return {
    includePageText: document.getElementById('include-page-text').checked,
    includeMetaDescription: document.getElementById('include-meta-description').checked,
    includeHeadings: document.getElementById('include-headings').checked,
    maxChars: Number(document.getElementById('max-chars').value) || DEFAULT_MAX_CHARS
  };
}

async function getTabsForMode(mode) {
  if (mode === 'currentTab') {
    return chrome.tabs.query({ active: true, currentWindow: true });
  }
  if (mode === 'currentWindow') {
    return chrome.tabs.query({ currentWindow: true });
  }
  return chrome.tabs.query({});
}

function isSupportedUrl(url) {
  if (!url) {
    return false;
  }
  return url.startsWith('http://') || url.startsWith('https://');
}

async function extractPageData(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const title = document.title || '';
      const url = location.href || '';
      const metaNode = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
      const metaDescription = metaNode ? metaNode.getAttribute('content') || '' : '';
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 30);

      let pageText = '';
      if (document.body) {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script, style, noscript, svg, canvas, iframe, nav, footer, aside').forEach((el) => el.remove());
        pageText = clone.innerText || document.body.innerText || '';
      }

      return {
        title,
        url,
        metaDescription,
        headings,
        pageText
      };
    }
  });

  if (!results || !results[0] || !results[0].result) {
    return { title: '', url: '', metaDescription: '', headings: [], pageText: '' };
  }

  return results[0].result;
}

function cleanText(text) {
  const safe = (text || '').replace(/\r/g, '');
  return safe
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildMarkdown(results, metadata) {
  const lines = [];
  lines.push('# Browser Context Pack');
  lines.push('');
  lines.push(`Generated: ${metadata.generatedAt}`);
  lines.push(`Extension: LLM Tab Context Exporter v${VERSION}`);
  lines.push(`Mode: ${metadata.modeLabel}`);
  lines.push(`Total tabs: ${metadata.totalTabs}`);
  lines.push(`Readable tabs: ${metadata.readableTabs}`);
  lines.push(`Skipped tabs: ${metadata.skippedTabs}`);
  lines.push('');
  lines.push('## Tab Index');
  lines.push('');

  results.forEach((result, index) => {
    if (result.skipped === 'unsupported') {
      lines.push(`${index + 1}. ${result.url} — unsupported URL`);
    } else {
      lines.push(`${index + 1}. [${result.title || '(Untitled Tab)'}](${result.url || ''})`);
    }
  });

  lines.push('');
  lines.push('---');
  lines.push('');

  results.forEach((result, index) => {
    lines.push(`# Tab ${index + 1}: ${result.title || '(Untitled Tab)'}`);
    lines.push('');
    lines.push(`URL: ${result.url || '(No URL)'}`);
    lines.push('');

    if (result.skipped === 'unsupported') {
      lines.push('Skipped: unsupported browser/internal URL.');
      lines.push('');
      lines.push('---');
      lines.push('');
      return;
    }

    if (result.skipped === 'error') {
      lines.push('Skipped: could not read page content.');
      lines.push(`Reason: ${result.reason}`);
      lines.push('');
      lines.push('---');
      lines.push('');
      return;
    }

    if (metadata.options.includeMetaDescription) {
      lines.push('## Meta Description');
      lines.push('');
      lines.push(result.metaDescription || '(No meta description found.)');
      lines.push('');
    }

    if (metadata.options.includeHeadings) {
      lines.push('## Headings');
      lines.push('');
      if (result.headings.length) {
        result.headings.forEach((heading) => lines.push(`- ${heading}`));
      } else {
        lines.push('- (No headings found.)');
      }
      lines.push('');
    }

    if (metadata.options.includePageText) {
      lines.push('## Visible Page Text');
      lines.push('');
      if (result.wasTruncated) {
        lines.push(`[Truncated: original page text was ${result.originalLength} characters; showing first ${result.shownLength} characters.]`);
        lines.push('');
      }
      lines.push(result.pageText || '(No visible page text found.)');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

async function exportTabs(mode) {
  const options = getExportOptions();
  const modeLabelMap = {
    currentTab: 'Current Tab',
    currentWindow: 'Current Window',
    allWindows: 'All Windows'
  };

  try {
    const tabs = await getTabsForMode(mode);
    setStatus(`Found ${tabs.length} tabs.`);

    const results = [];
    let readableTabs = 0;
    let skippedTabs = 0;

    for (let i = 0; i < tabs.length; i += 1) {
      const tab = tabs[i];
      const title = tab.title || '(Untitled Tab)';
      const url = tab.url || '';
      setStatus(`Exporting ${i + 1} / ${tabs.length}...`);

      if (!isSupportedUrl(url)) {
        skippedTabs += 1;
        results.push({ title, url, skipped: 'unsupported' });
        continue;
      }

      try {
        const extracted = await extractPageData(tab.id);
        const cleanedText = cleanText(extracted.pageText);
        const originalLength = cleanedText.length;
        const truncatedText = cleanedText.slice(0, options.maxChars);
        const wasTruncated = originalLength > options.maxChars;

        readableTabs += 1;
        results.push({
          title: extracted.title || title,
          url: extracted.url || url,
          metaDescription: cleanText(extracted.metaDescription),
          headings: (extracted.headings || []).map((heading) => cleanText(heading)).filter(Boolean),
          pageText: options.includePageText ? truncatedText : '',
          originalLength,
          shownLength: options.includePageText ? truncatedText.length : 0,
          wasTruncated: options.includePageText && wasTruncated
        });
      } catch (error) {
        skippedTabs += 1;
        results.push({ title, url, skipped: 'error', reason: error && error.message ? error.message : 'Unknown error' });
      }
    }

    const markdown = buildMarkdown(results, {
      generatedAt: new Date().toISOString(),
      modeLabel: modeLabelMap[mode],
      totalTabs: tabs.length,
      readableTabs,
      skippedTabs,
      options
    });

    outputEl.value = markdown;
    setStatus(`Done. Readable: ${readableTabs}. Skipped: ${skippedTabs}.`);
  } catch (error) {
    setStatus(`Export failed: ${error && error.message ? error.message : 'Unknown error'}`);
  }
}

async function copyMarkdown() {
  const markdown = outputEl.value.trim();
  if (!markdown) {
    setStatus('Nothing to copy yet.');
    return;
  }

  try {
    await navigator.clipboard.writeText(markdown);
    setStatus('Copied Markdown to clipboard.');
  } catch (error) {
    setStatus(`Copy failed: ${error && error.message ? error.message : 'Unknown error'}`);
  }
}

function downloadMarkdown() {
  const markdown = outputEl.value.trim();
  if (!markdown) {
    setStatus('Nothing to download yet.');
    return;
  }

  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const filename = `browser-context-pack-${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}.md`;

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  setStatus(`Downloaded ${filename}`);
}
