# TextFlow

**Version 1.3.4**

© 2026 HTG

Modern Chrome extension for text expansion and smart form filling.

## Features

- **Folders** – Organize snippets into colored folders
- **Tags** – Full CRUD tag management with multi-select filtering
- **Modern tag picker** – Badge-style tags when adding/editing snippets; pick existing or create new
- **Clear filters** – One-click reset of search, folder, and tag filters
- **CRUD Snippets** – Add, edit, delete expansions
- **Search, Filter & Sort** – By text, folder, tags, recency or usage
- **Chrome Sync Toggle** – Enable/disable sync independently
- **Backup** – Export / Import full JSON (snippets + folders + tags + settings)
- **Text Expansion** – Type shortcut → Space (configurable) to expand
- **Dynamic Placeholders** – `{{date}}`, `{{time}}`, `{{datetime}}`, `{{year}}`
- **Form Auto-Populate** – Detects common fields and fills them (`Ctrl+Shift+F`)
- **Modern UI** – Lucide-style icons, Light & Dark themes, forest-green accent (#2E6F40), App logo + title
- **Logo** – SVG logo at `icons/logo.svg`

## Installation (Developer Mode)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `auto-text-expander` folder

## Quick Start

- Sample snippets ship with the extension (`;hello`, `;sig`, `;date`, `;email`)
- Popup: quick add, search, folder filter, tag chips, sort
- Options page (gear icon): full table, Folders CRUD, Tags CRUD, Settings, Backup & Sync

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Open TextFlow popup |
| `Ctrl+Shift+F` | Auto-fill current form |

## Project Structure

```
auto-text-expander/
├── manifest.json
├── popup.html
├── options.html
├── styles/
│   ├── common.css
│   ├── popup.css
│   └── options.css
├── scripts/
│   ├── background.js
│   ├── content.js
│   ├── storage.js
│   ├── popup.js
│   └── options.js
├── icons/
└── README.md
```
