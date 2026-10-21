# Rework the start screen around finding a client

## Summary
The start screen now leads with signing in and searching for a client, and a welcome page explains how the assistant works and what keeps the caseworker in control.

## Changes made
- `sidepanel/view-intake.mjs`: new start screen (directory card first, then "Enter client details" and "Upload a document", then "Renewals due" and the AI assistant status); new "Enter client details" screen with sample clients, a typed form and an Advanced paste. The shared planner API settings are commented out.
- Added `sidepanel/view-welcome.mjs` and a once-per-browser-session welcome page in `sidepanel/main.mjs` (stored in `chrome.storage.session`).
- `sidepanel/view-directory.mjs` is now a card on the start screen; the separate sign-in and search screens were removed. One search box tries an ID-looking query as an ID, then falls back to a name search.
- `sidepanel/actions-intake.mjs`: handlers for typed details, sample clients, the welcome page and the new search; removed the sample-record and choose-JSON actions.
- `sidepanel/index.html`: removed the header ×. "Recertification status" became "Renewals due".
- `shared/mock-scenarios.mjs`: sample client labels and descriptions rewritten for caseworkers. README and the guides use the new names.
- Updated the panel, action and safety tests.

## What it improves or fixes
Before: the first screen offered a record ID lookup and a JSON paste, the safeguards were a collapsed note, a header × did what Back already does, and the wording was technical ("Agentic AI required", "Recertification status"). After: the first action is finding a client, the safeguards are on a welcome page, and each option explains what it does. Only the directory search needs a login.

Only the start, welcome, details and search screens were reworded. The program choice, dashboard and review screens still use the older wording.

## How to run / verify
```bash
npm test
```

Open `sidepanel/index.html?preview=1` from a local web server, or load the unpacked extension. Check the welcome page, then **Get started**, **Fill these in**, **Sign in**, a search for `thomas`, and **Enter client details**.
