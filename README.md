# LLM Tab Context Exporter

A local-only Chrome extension that exports open tabs into Markdown for LLM context.

## Features

- Export **Current Tab**, **Current Window**, or **All Windows** tabs.
- Output clean, LLM-readable Markdown with tab index and per-tab sections.
- Optional inclusion of visible page text, meta description, and headings.
- Per-tab text truncation controls (2000, 5000, 12000, 25000, 50000 chars).
- Copy Markdown to clipboard or download as `.md`.
- Graceful handling of unsupported/internal browser URLs and extraction errors.

## Supported browsers

- Google Chrome
- Microsoft Edge
- Brave
- Other Chromium browsers may work, but are not optimized in v0.1.0.

## Privacy

- Runs locally in your browser.
- Does not send data to a server.
- Does not use analytics.
- Reads tab/page content only after the user clicks an export button.

## Manual install

1. Download or clone this repo (`Browser-Context-Pull`).
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Enable Developer mode.
5. Click **Load unpacked**.
6. Select the `extension/` folder.
7. Pin the extension.
8. Click the extension icon and export tabs.

## Usage

1. Open the extension popup.
2. Pick export mode: Current Tab, Current Window, or All Windows.
3. Choose options:
   - Include page text
   - Include meta description
   - Include headings
   - Max characters per tab
4. Click an export button.
5. Copy Markdown or Download Markdown.

## Development

- Plain HTML/CSS/JS, Manifest V3.
- No backend.
- No external packages.

- Icons are stored as text-based SVG placeholders to avoid binary-file PR issues in tooling.

Quick checks:

```bash
npm run check
```

## Build release ZIP

```bash
npm run zip
```

Produces:

- `dist/llm-tab-context-exporter-v0.1.0.zip`

## Known limitations

- Cannot read `chrome://`, `edge://`, `brave://`, `about:`, extension pages, and some browser-internal pages.
- Cannot reliably read some PDFs.
- Cannot read video/audio content.
- Cannot read text rendered only inside canvas.
- May not read cross-origin iframe content.
- Pages requiring login are only readable if already loaded and accessible in the active browser session.

## Roadmap

- Firefox support
- Safari support later
- Better readable-mode extraction
- Token/character estimate
- Save presets
- Export selected tabs only
- Optional summarization by user-provided local model endpoint, but not in v0.1.0

## Testing checklist

- [ ] Load unpacked extension in Chrome.
- [ ] Export current tab on a normal website.
- [ ] Export current window with multiple tabs.
- [ ] Export all windows.
- [ ] Test unsupported page like `chrome://extensions`.
- [ ] Test Copy Markdown.
- [ ] Test Download Markdown.
- [ ] Test max character truncation.
- [ ] Test with Include page text unchecked.
- [ ] Test with Include headings unchecked.
- [ ] Test with Include meta description unchecked.
- [ ] Test in Microsoft Edge.
- [ ] Test in Brave.


### SPA pages that stay on "Loading"

Some sites render content late via JavaScript or in protected/cross-origin frames. v0.1.0 now waits briefly before extraction and falls back to raw `textContent` to improve capture, but some embedded/remote content may still be inaccessible to extensions.
