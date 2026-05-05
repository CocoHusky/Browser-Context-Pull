# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-05-05

### Added
- JSON export functionality with structured data including browser info, window/tab counts, and detailed tab information
- Context text support in JSON exports (added as "context" field when present)

### Changed
- Output display and copy format changed from plain text to Markdown with link syntax (`- [Title](URL)`)
- Window labeling changed from alphabetical (a, b, c) to numerical (1, 2, 3)
- Download TXT button replaced with Download JSON button
- Multi-window exports now use `## Window X` headers instead of summary tables

### Updated
- README.md with new output format examples for both Markdown and JSON
- STORE_LISTING.md to reflect JSON download capability
- UI button labels and documentation references

### Technical
- Refactored `getOutputForMode()` to generate both Markdown and JSON outputs simultaneously
- Updated `formatCurrentTab()` and `formatWindowSection()` for Markdown link formatting
- Added global `jsonOutput` variable for JSON download functionality
- Modified download handler to support JSON MIME type and `.json` extension

## [1.1.0] - 2026-05-04

### Added
- Initial release of URL Picker extension
- Export functionality for current tab, current window, or all browser windows
- Grouping of multi-tab exports by browser window with summary tables
- Saved context text feature added to the top of exports
- Copy to clipboard functionality
- Download as Markdown or plain text
- Filtering options: remove Google Search tabs, non-http(s) pages, and duplicate URLs
- Local storage for context text persistence

### Features
- Chrome extension with popup interface
- Tab title and URL collection using Chrome APIs
- Clean text output formatting
- Privacy-focused: runs locally, no data transmission