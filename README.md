# URL Picker

URL Picker is a Chrome extension for collecting tab titles and URLs from the current tab, the current browser window, or every open browser window. The generated text can be copied to the clipboard or downloaded as Markdown or plain text.

## Features

- Export the current tab, current window, or all browser windows.
- Group multi-tab exports by browser window.
- Add saved context text to the top of each export.
- Copy the generated output to the clipboard.
- Download the generated output as Markdown or JSON.
- Filter out Google Search tabs, non-http(s) pages, and duplicate URLs.

## Output Format

Current tab exports use a single line:

```markdown
- [Tab name](URL)
```

Current window and all windows exports include grouped tab lists:

```markdown
## Window 1

- [Tab name](URL)
- [Another tab name](URL)

## Window 2

- [Tab name](URL)
```

## JSON Output

The JSON output provides structured data:

```json
{
  "browser": "Chrome",
  "window_count": 2,
  "tab_count": 6,
  "windows": [
    {
      "window_id": 1,
      "tab_count": 2,
      "tabs": [
        {
          "position": 1,
          "title": "Chrome Web Store Extensions",
          "url": "https://chromewebstore.google.com/category/extensions"
        },
        {
          "position": 2,
          "title": "Another Tab",
          "url": "https://example.com"
        }
      ]
    }
  ]
}
```

If context is added, it includes a "context" field.

## Filters

All filters are enabled by default and can be turned off in the popup.

- **Remove Google Search tabs** removes tabs with Google Search result pages.
- **Remove non-http(s) pages** removes browser pages such as `chrome://extensions/` and `chrome://newtab/`.
- **Remove duplicate URLs** keeps the first matching URL and removes later duplicates.

## Saved Context

The context field is saved in the extension with `chrome.storage.local`. The text stays available after the popup or browser window is closed and is added to the top of each generated export.

## Install

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` folder.
5. Pin the extension from the Chrome toolbar.

## Privacy

URL Picker runs locally in the browser. It does not send tab data, saved context text, or generated exports to any server. See [PRIVACY.md](PRIVACY.md).

## Usage

1. Open the extension popup.
2. Choose **Current Tab**, **Current Window**, or **All Windows**.
3. Add or update the saved context text if needed.
4. Adjust filters if needed.
5. Click **Copy**, **Download MD**, or **Download JSON**.

## Development

Run the JavaScript syntax check:

```bash
npm run check
```

Build the extension ZIP:

```bash
npm run zip
```

The packaged extension is written to `dist/url-picker-v1.1.0.zip`. The `dist/` folder is generated locally and is not kept in the repository.

Uses `extension/icons/icon.png` as the source icon and uses generated `16`, `48`, and `128` PNGs in the Chrome manifest.

## Chrome Web Store

Use [STORE_LISTING.md](STORE_LISTING.md) for listing copy, permission justifications, and privacy field language.

Before uploading:

1. Run `npm run check`.
2. Run `npm run zip`.
3. Upload `dist/url-picker-v1.1.0.zip` in the Chrome Developer Dashboard.
4. Confirm the uploaded package shows version `1.1.0`.
