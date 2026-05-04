# Chrome Web Store Listing Draft

## Name

URL Picker

## Short Description

Copy or download tab titles and URLs from the current tab, current window, or all windows.

## Detailed Description

URL Picker helps collect browser tab titles and URLs into a clean text export.

Choose the current tab, current window, or all open browser windows. Multi-window exports are grouped by browser window and include a short summary at the top. Add optional saved context text to the top of each export, then copy the result or download it as Markdown or plain text.

Filters are enabled by default for Google Search tabs, non-http(s) pages, and duplicate URLs.

URL Picker runs locally in the browser. It does not send tab data or saved context text to any server.

## Category

Productivity

## Single Purpose

URL Picker exports tab titles and URLs selected by the user from the current tab, current window, or all open browser windows.

## Permission Justifications

### `tabs`

Used to read tab titles and URLs for the export selected by the user.

### `storage`

Used to save the optional context text entered by the user in the popup.

## Privacy Summary

URL Picker handles tab titles, tab URLs, and user-entered context text locally. It does not collect, transmit, sell, or share user data.

## Suggested Screenshots

- Popup with filters and context field visible.
- Current window export with grouped output.
- Download buttons visible.
