# Add a Developer mode switch for the experimental features

## Summary
Experimental features are now off by default. One switch, "Developer mode" under the settings on the start screen, turns them on. The setting is stored in `chrome.storage.local` and survives closing the panel. Only the stored value `true` means on; a missing value, a store that throws, or no store at all means off.

## Changes made
- `shared/developer-mode.mjs`: reads and writes the setting, and holds the one reviewable list of experimental click, submit and change actions, panel views and service worker message types (the lists are read-only to importers).
- `sidepanel/actions-developer.mjs`: the `toggle-developer-mode` action and `applyDeveloperMode`. The switch refuses to change the mode while an application run is active in this panel. Applying a change re-reads the planner provider, clears this window's CAPTCHA authorizations when turning off, and moves the panel from an experimental view to the session's home screen (the dashboard, the program choice or the start screen). Each Chrome window has its own side panel; every panel applies a change made in another window through the same path, from its `chrome.storage.onChanged` listener.
- `sidepanel/ui-dispatch.mjs`, `sidepanel/main.mjs`: the dispatcher refuses experimental actions when the mode is off. The panel reads the setting before its first render, so nothing experimental is drawn until the read finishes.
- `sidepanel/view-intake.mjs`, `view-applications.mjs`, `view-review.mjs`: experimental controls are only drawn when the mode is on. The `client-link` questions link and the `pause` button are hidden when off; "End this session" is the stop path.
- `background/service-worker.mjs`, `background/captcha-service.mjs`: the service worker refuses six experimental message types when off, answering `{ ok: false, error: 'Developer mode is off.' }`. The connector router is split: `OPEN_PROGRAMS` and `GET_CONNECTOR_STATUS` stay core. Turning the mode off cancels running CAPTCHA attempts. The CAPTCHA content agent is never injected while off: it is not a manifest content script, and only the service worker's CAPTCHA `begin` command injects it, which is refused when off. The application runner also never starts a CAPTCHA attempt while off, even for an authorization given earlier.
- `shared/agentic-planner.mjs`, `shared/planner-runtime.mjs`, `sidepanel/agent-runtime.mjs`: with the mode off the model runtime list offers only Gemini Nano, and the planner is configured with `gateway: false`, so a saved shared planner API is not used for planning, runtime preparation or client links.
- `sidepanel/automatic-runs.mjs`, `actions-intake.mjs`, `run-control.mjs`, `actions-applications.mjs`: with the mode off, one application at a time (see below).
- Tests for each of these, including that every experimental action and message type refuses when off.

## What it gates
- CAPTCHA attempts and images
- Codex, Claude and Jev companion options and the shared planner API settings
- Connector and mock-service screens and routes
- Renewals and recertification
- Pause and handoff
- Concurrent applications (one application at a time when off; see below)
- The `client-link` questions link

Core paths are unchanged, including the participant directory (it opens a client through `directory.findById`, not `LOOKUP_RECORD`).

## Behavior worth knowing
- Switching is blocked while an application run is active in the panel used to switch. Another window's panel applies the change even if it has a run going; its planner is reconfigured, which can stop that run.
- With the mode off, "Use this model runtime" never writes or removes the stored provider. A stored Codex, Claude, Jev or shared-API choice is not used (the planner behaves as Nano) and is kept, so turning the mode on restores it.
- One application at a time, with the mode off, means three rules: the application-selection screen accepts one workflow per selection (CalFresh, Medi-Cal and CalWORKs share one BenefitsCal workflow); the automatic queue runs one application at a time, so a second add waits; and a run the caseworker starts from a card (fill, run, answers, resume) or **Analyze this form** is refused with "Wait for the running application to stop first." while another application's run is active. Starting the application that is already running again is allowed. The automatic queue does not check for a caseworker-started run, so a queued application can still start while one is going (see [TODO.md](../TODO.md#developer-mode)).
- A CAPTCHA checkpoint stays a human checkpoint: "Try CAPTCHA" is hidden, but the core "resume after you complete it" action remains.
- Handoff and renewals state is ignored when off, not deleted.
- The switch is not a security boundary against a determined user; it hides and refuses features by default.

## What it improves or fixes
Before: every experimental feature was reachable in the default build, including CAPTCHA attempts and companion providers. After: a default install shows the core caseworker flow only, and the experimental list is in one file for the maintainer to keep or remove. Open follow-ups are in [TODO.md](../TODO.md#developer-mode).

## How to run / verify
```bash
node --test tests/developer-mode.test.cjs tests/sidepanel-actions.test.cjs tests/panel-views.test.cjs tests/background-coordinator.test.cjs
npm test
```
In Chrome (load unpacked): with the switch off, only Gemini Nano is offered and there are no CAPTCHA, handoff, renewals or connector controls. Open the start screen settings, choose Developer mode, **Turn on**, and they return. Reload the panel and confirm the setting persisted. This manual check has not been run.
