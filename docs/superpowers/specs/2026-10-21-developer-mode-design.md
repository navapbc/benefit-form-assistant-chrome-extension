# Developer mode: a switch that keeps experiments out of the default app

Date: October 21, 2026. Branch: `chore/security-and-dev-mode`. Status: draft for review.

## Intent and why

This repository is becoming an open-source template. Someone who downloads it should get the part of the app that works, not the experiments around it. The maintainer wants to test the experimental features themselves before deciding which to keep and which to harden, so this change does not remove or rewrite them. It puts them behind one switch that is off by default.

The switch is a guard against accidental or casual use of experiments. It is not a security boundary against a determined user, who can flip it. The real boundaries (extension permissions, the human checkpoints, the stop before certification, signature and submission) are unchanged.

## Goals

1. A **Developer mode** switch in the side panel, off by default, stored in `chrome.storage.local` so it survives restarts.
2. With the switch **off**, the panel shows only the core app, and the service worker refuses the experimental commands, so hiding a button is never the only protection.
3. With the switch **on**, behavior is exactly what it is today.
4. A single list in code that says which features are experimental, so the maintainer can later review it, move a feature to core, or delete it.
5. Tests that prove the gating in both states.

## Non-goals

- No security hardening beyond the gating. Fixing the items in `docs/TODO.md` ("Security and privacy", "Participant directory") comes later, after the maintainer has tested the experiments.
- No deleting of experimental code. The maintainer will decide what to keep afterwards.
- No build-time flag, no gitignored config file, no URL parameter. Only the in-panel switch, for now.
- No change to Nava branding, the license, or the docs added in PR 15.
- No change to what core features do.

## Anti-goals (a failure even if it technically works)

- A hidden control whose handler still runs when called, or whose service-worker route still answers.
- Experimental state silently left over after the switch is turned off (for example a CAPTCHA attempt that keeps running, or a stored experimental model runtime that is still used by the planner).
- Turning the switch on changing anything that was working in core.
- A switch that fails open: a missing, corrupt or unreadable setting must mean **off**.

## What is core and what is experimental

These calls are the maintainer's direction, plus guesses marked as such.

**Core (always available):**
- Gemini Nano as the form planner, including its setup.
- Entering client details and the four sample clients.
- Document upload and review.
- The participant directory (find a client, sign in, sign out), and the not-configured state.
- Filling **one application at a time**, with questions, review, and the activity log export.
- The stop before certification, signature and submission, and the existing human checkpoints.

**Experimental (behind the switch):**
- CAPTCHA attempts and CAPTCHA images, including the "Try CAPTCHA…" and "CAPTCHA images · experimental" controls, the service worker's CAPTCHA route, and the CAPTCHA content agent's activation.
- The Codex, Claude and Jev companion options in the model-runtime dropdown, and everything that pairs with the local companion (`model-bridge/`).
- Shared planner API settings (already commented out in `sidepanel/view-intake.mjs`; keep them out, and keep the handlers refusing when off).
- The connector and mock service screens and routes (record ID, "Manage data source", provider catalog, local connector settings).
- Renewals / recertification ("Renewals due").
- Pause and handoff (`pause`, `open-handoff`, `accept-handoff`, and related controls).
- Running several applications at once. *(Maintainer's call, my reading of the README: concurrent runs are not demonstrated.)* With the switch off, one application runs at a time.

**Borderline, my calls, easy to change:**
- The activity log export stays core.
- "Add application" and the application-selection screen stay core, limited to one running application when off. The builder should decide whether adding a second application is blocked or only running two at once is.
- The welcome page and the directory stay core.

## Constraints from the code as it is

- The panel has one click, submit and change dispatcher, `sidepanel/ui-dispatch.mjs`, built from per-domain action tables (`INTAKE_*`, `CONNECTOR_*`, `APPLICATION_*`, `RECERTIFICATION_*`, `AGENT_*`). That is the natural place to refuse an experimental action.
- The service worker routes messages in `routeMessage` (`background/service-worker.mjs`). The CAPTCHA route is checked **before** the side-panel sender check, which the builder should treat carefully: the gate must apply there too, and the builder should note whether the CAPTCHA route verifies its sender elsewhere.
- Other routes: session, application run, and connector. The coordinator and lease logic lives in `background/coordinator-rules.mjs`, `application-runs.mjs` and `client-session.mjs`.
- The panel has no build step. Modules must stay plain ES modules, and `npm run check:modules` forbids top-level `await`, cycles, and `Nava*` global reads (PR 15 hit this).
- The page agent in `content/` and six files in `shared/` stay classic scripts, loaded through `shared/engines.mjs`.
- `shared/*.local.mjs` is gitignored and never packaged. This change does not use it.
- `scripts/shipped-files.mjs` defines what ships. Experimental code that stays in `shared/`, `sidepanel/`, `background/` and `content/` still ships; only `model-bridge/`, `connector-service/`, `evaluation/` and `docs/` do not.
- CI runs lint, typecheck (a ratchet), check, check:package, check:modules, check:vendor, check:docs, the unit tests, and the extraction evaluation. All must stay green.

## The parts of the how that were decided

- **Where the switch lives:** a toggle in the side panel. It is the only way to turn the mode on for now.
- **What "off" means for everyone who downloads the repo:** the bare minimum of working features (the core list above).
- **Gating happens in two places:** the panel (hide and refuse) and the service worker (refuse). Both read the same stored setting.
- **Default is off,** including for existing installs after the update.
- **This branch does not change security behavior** beyond gating. The hardening comes later.

## Left to the builder

- Where in the panel the switch sits and how it is worded (plain language for caseworkers is the existing style).
- The storage key name and shape, and how the panel and the service worker share it (for example a small shared module and a `chrome.storage.onChanged` listener). The service worker must not trust a value passed in a message; it should read storage itself.
- The exact list of dispatcher action names and message types to gate, built from the inventory above and checked against the code. Include anything the inventory missed.
- How to behave when the switch is turned off while experimental state exists: a running CAPTCHA attempt, a paired companion, a stored experimental model runtime or agent provider (`nava:agent-provider`), a stored connector, recertification workspace, handoff, or more than one running application. The anti-goals say what must not happen; the builder chooses the mechanism, and should prefer stopping or ignoring the state over deleting it, so turning the switch back on loses nothing.
- Whether a persistent indicator (for example a small "Developer mode" badge) shows while the mode is on.
- How to structure the code so the experimental list is one reviewable place.
- Tests, including a test that every experimental dispatcher action and service worker message type refuses when off.
- Documentation: a short note in `README.md`, `docs/TODO.md`, `docs/RECENT_CHANGES.md` and a change doc under `docs/changes/` (the `change-docs` skill).

## Calls made after the builder check

These settle questions a first reader would otherwise have to guess at. The first six are my calls, marked so they can be changed. The last is a fact from the code.

1. **One application at a time (my call).** With the switch off, the program-selection screen allows one workflow at a time. A workflow is what `shared/program-catalog.mjs` groups under one `workflowId`, so CalFresh, Medi-Cal and CalWORKs, which share one BenefitsCal application, still count as one. The cap is enforced where applications are added and where a batch is queued (`openSelectedPrograms`, `enqueueApplicationBatch`), not by changing the coordinator, leases or queue. If a session already holds more than one application when the switch is turned off, they stay listed but only one may run; the rest wait.
2. **Directory and connector are separate paths (answered from the code).** The directory opens a client through `directory.findById` in `sidepanel/actions-intake.mjs`, not through `LOOKUP_RECORD`. `LOOKUP_RECORD` is used only by the record-ID flow and the renewals caseload, both experimental. So with the switch off the service worker refuses `LOOKUP_RECORD` and every message the connector router owns, and the directory is unaffected.
3. **How a refused command answers (my call).** A refused panel-only message gets the existing "no response" treatment for unknown types (`false`). A refused CAPTCHA command answers `{ ok: false, error }` with a plain sentence, because the panel already shows that error for a stopped attempt. Turning the switch off cancels any running CAPTCHA attempt using the existing cancel path (`captchaService.cancelApplications`), and the CAPTCHA content agent does nothing while the setting is off.
4. **A core application sitting at an experimental checkpoint (my call).** A CAPTCHA checkpoint stays what it is today: a human checkpoint. With the switch off the panel hides "Try CAPTCHA…" but still offers the core "resume after you complete it" action, so the caseworker finishes it by hand and continues. Handoff and renewals state is ignored, not deleted, and returns when the switch is turned back on.
5. **Model runtime when off (my call).** The dropdown lists only Gemini Nano. A stored Codex, Claude, Jev or shared-API choice is not used by the planner (it behaves as Nano) and is not overwritten, so turning the switch back on restores it.
6. **First paint (my call).** The panel reads the setting before its first render. Its start-up is already asynchronous (`bootstrap` in `sidepanel/main.mjs`), so no top-level `await` is needed. The panel renders nothing experimental until the read finishes; an unreadable value means off.
7. **The action tables do exist (answered from the code).** `sidepanel/ui-dispatch.mjs` builds its click, submit and change tables from the agent, recertification, intake, connector and application groups. Some tables mix core and experimental actions (for example `pause`, `open-handoff` and `accept-handoff` sit with core application actions), so the builder gates by individual action name, not by whole table.

## Resolved at build time

- The connector router is split: `OPEN_PROGRAMS` and `GET_CONNECTOR_STATUS` stay core; six message types are refused when off.
- Refused messages answer `{ ok: false, error: 'Developer mode is off.' }` rather than silence.
- The mode cannot be switched while an application run is active.
- With the mode off, "Use this model runtime" never writes or removes the stored provider (only Nano for the session).
- The one-application rule is per submission plus the pump's one-at-a-time limit (a second add queues).
- `client-link` is hidden when off.
- `pause` is hidden when off; "End this session" is the stop path.
