# LinkedIn Connect Automation

Chrome Manifest V3 extension for automating LinkedIn connection invitations on People Search pages.

The extension discovers actionable profile cards, processes them sequentially, handles LinkedIn invitation dialogs, navigates through search-result pages, persists automation state between service-worker restarts, applies configurable rate limits, and exposes progress through a popup dashboard.

> This project was created as a technical assignment and is intended for demonstration and educational purposes.

---

## Features

- Chrome Manifest V3 architecture
- LinkedIn People Search target discovery
- support for virtualized / dynamically loaded result lists
- Connect, Pending, Message, Follow and More action detection
- Connect resolution through overflow menus
- trusted mouse interaction through Chrome Debugger API + CDP
- invitation modal handling
- configurable daily and weekly invitation limits
- randomized delays between actions
- persistent counters and invitation history
- MV3 service-worker recovery through `chrome.alarms`
- pause / resume support
- pagination recovery
- popup dashboard
- persistent recent-event log

---

## Installation

1. Clone the repository.

```bash
git clone <repository-url>
```

2. Open Chrome and navigate to:

```text
chrome://extensions
```

3. Enable **Developer mode**.

4. Click **Load unpacked**.

5. Select the project directory.

The extension will appear in the Chrome toolbar.

---

## Usage

Open a LinkedIn People Search page, for example:

```text
https://www.linkedin.com/search/results/people/
```

Open the extension popup and configure the desired daily and weekly limits.

The popup displays:

- automation status;
- current search-result page;
- current target progress;
- sent invitations;
- skipped targets;
- failed targets;
- remaining daily allowance;
- remaining weekly allowance;
- recent automation events.

Use:

```text
Start
Pause
Resume
```

to control the automation.

---

## Safety switch

The project currently contains a development safety switch in the queue:

```js
const LIVE_CONNECT_ENABLED = false;
```

When disabled, the extension can discover targets and execute the surrounding automation flow without performing a real Connect click.

This is intentionally kept disabled during development and automated-flow testing.

It should only be enabled for a controlled end-to-end demonstration.

---

# Architecture

The extension is separated into three primary runtime areas:

```text
Popup
   │
   │ runtime messages
   ▼
Service Worker
   │
   ├── persistent state
   ├── queue
   ├── rate limiting
   ├── recovery
   ├── trusted input
   │
   │ tab messages
   ▼
Content Scripts
   │
   ├── target discovery
   ├── DOM resolution
   ├── pagination
   └── modal detection
```

The content script is responsible for inspecting the LinkedIn DOM.

The service worker owns automation state and browser-level capabilities such as:

```text
chrome.debugger
chrome.storage.local
chrome.alarms
```

This separation keeps privileged browser APIs outside the page-facing content script.

---

## Project structure

```text
src/
├── background/
│   ├── automation.js
│   ├── input.js
│   ├── log.js
│   ├── page.js
│   ├── queue.js
│   ├── rate-limit.js
│   ├── recovery.js
│   ├── service-worker.js
│   ├── state.js
│   ├── timing.js
│   └── utils.js
│
├── content/
│   ├── actions.js
│   ├── content.js
│   ├── modals.js
│   ├── pagination.js
│   ├── targets.js
│   └── utils.js
│
└── popup/
    ├── popup.css
    ├── popup.html
    └── popup.js

manifest.json
README.md
```

---

# Automation state

The main automation state is persisted through:

```js
chrome.storage.local
```

The state contains information such as:

```text
status
tabId
targets
currentIndex
currentPage
nextPage

sent
skipped
failed

rateLimits
invitationHistory
pendingAction
```

Persisting this information is important because Manifest V3 service workers are not guaranteed to remain alive between actions.

---

## State lifecycle

The main runtime states are:

```text
idle
running
waiting_next_page
paused
stopped
```

A simplified state flow is:

```text
               ┌──────────┐
               │   idle   │
               └────┬─────┘
                    │ Start
                    ▼
               ┌──────────┐
               │ running  │
               └────┬─────┘
                    │
          ┌─────────┼─────────┐
          │         │         │
          │ Pause   │ page end│ terminal condition
          ▼         ▼         ▼
      ┌────────┐  ┌───────────────────┐
      │ paused │  │ waiting_next_page │
      └───┬────┘  └─────────┬─────────┘
          │ Resume           │ next page
          └──────────┐       │
                     ▼       ▼
                   running

terminal conditions
       │
       ▼
   stopped
```

`paused` is intentionally different from `stopped`.

A user pause preserves:

```text
currentPage
currentIndex
sent
skipped
failed
```

so the run can be resumed.

`stopped` represents a completed or terminal automation state, for example:

- no remaining pages;
- local rate limit reached;
- LinkedIn weekly limit reached;
- unknown modal;
- unrecoverable target resolution failure.

---

# Target discovery

LinkedIn search results may be dynamically rendered and may not exist in the DOM at the same time.

The extension therefore does not depend on a single initial DOM snapshot.

Instead it repeatedly:

```text
collect visible actions
        ↓
deduplicate targets
        ↓
scroll search results
        ↓
wait for dynamic rendering
        ↓
collect again
```

Collection stops after several consecutive passes produce no new targets.

The page is scanned from the beginning so the target order remains as stable as possible across reload and resume operations.

---

## Target types

The content layer currently recognizes:

```text
CONNECT
PENDING
MESSAGE
FOLLOW
MORE
```

The extension processes direct Connect targets and can also open a profile-card overflow menu when Connect is exposed through a More action.

Other recognized states are skipped and recorded rather than clicked as connection invitations.

---

## Stable target identity

Target identity avoids relying on generated LinkedIn CSS classes.

Where available, target information includes:

```text
action type
aria-label
href
profile href
```

For overflow-menu targets, the profile URL is particularly useful because multiple cards may otherwise contain identical:

```text
More
```

buttons.

Example target identities:

```text
MORE|/in/user-a/||More
MORE|/in/user-b/||More
```

This also helps the extension re-resolve the correct DOM element immediately before interaction.

---

## Re-resolving coordinates

Coordinates collected during the initial scan can become stale because LinkedIn dynamically rerenders and virtualizes content.

For that reason the queue does not blindly reuse old coordinates.

Before a trusted click it asks the content script to locate the target again:

```text
Stored target
     │
     ▼
Find current DOM element
     │
     ▼
scrollIntoView()
     │
     ▼
re-resolve DOM element
     │
     ▼
getBoundingClientRect()
     │
     ▼
fresh { x, y }
```

This reduces failures caused by scrolling and DOM replacement.

---

# Pagination

At the end of the current target list, the extension checks for an enabled Next-page control.

If another page is available, automation transitions to:

```text
waiting_next_page
```

The next-page click is delayed using the same timing system as target processing.

The content script waits for the active page number to change and then performs a fresh target scan.

Only one page-change `MutationObserver` is kept active at a time so Pause → Resume cannot create duplicate observers.

---

# Modal handling

After a Connect click, the service worker polls the content script for the current modal state.

The extension currently recognizes the following states.

## Add note

When LinkedIn presents:

```text
Send without a note
```

the extension resolves that button and clicks it using the trusted-input mechanism.

After the dialog closes:

```text
sent counter++
invitation history updated
rate limits recalculated
event logged
```

---

## Email / relationship verification

Dialogs containing:

```text
How do you know
```

are treated as verification flows.

The extension attempts to locate a visible dismiss / close / cancel action.

The target is then recorded as skipped.

---

## LinkedIn weekly invitation limit

When LinkedIn reports that the weekly invitation limit has been reached, automation stops immediately.

This LinkedIn-side limit is independent of the extension's own configurable local limits.

---

## Unknown modal

Unexpected centered modal content is treated conservatively.

Instead of guessing what to click, the extension:

```text
stops automation
captures modal text
captures modal DOM
logs the condition
```

This prevents an unknown dialog from producing an unintended action.

---

# Rate limiting

The extension implements configurable local:

```text
daily invitation limit
weekly invitation limit
```

Invitation timestamps are stored persistently.

The limits are calculated using sliding time windows:

```text
last 24 hours
last 7 days
```

Before any Connect interaction, the queue checks whether another invitation is allowed.

If a local limit has been reached, automation stops before interacting with the LinkedIn page.

The popup displays:

```text
Daily remaining
Weekly remaining
```

and allows both limits to be configured.

---

# Timing

Actions are not executed using a constant interval.

The extension samples an inter-target delay from a bounded randomized distribution.

The delay configuration includes:

```text
mean
standard deviation
minimum
maximum
```

The generated value is clamped to the configured range.

This avoids a perfectly fixed action cadence while still keeping timing bounded and predictable.

This should not be interpreted as an anti-detection guarantee.

---

# Manifest V3 recovery

Manifest V3 service workers can be suspended when Chrome considers them idle.

Long-running automation therefore cannot depend on JavaScript timers alone.

The extension persists delayed actions as:

```js
pendingAction
```

and creates a matching:

```js
chrome.alarms
```

watchdog.

Supported recovery actions currently include:

```text
NEXT_TARGET
NEXT_PAGE
```

A simplified flow is:

```text
Queue schedules delayed action
          │
          ▼
pendingAction saved
          │
          ▼
chrome.alarms watchdog created
          │
          ├──────────── worker survives ────────────┐
          │                                         │
          ▼                                         ▼
normal delay completes                    alarm restores continuation
          │                                         │
          └────────────────────┬────────────────────┘
                               ▼
                        automation continues
```

The alarm is consumed before replaying the action to prevent duplicate continuation.

---

## Recovery reconciliation

A persisted action and its Chrome alarm can become temporarily inconsistent.

For example, Chrome may restart after state was written.

The extension therefore checks recovery state:

- when the service worker is evaluated;
- on browser startup.

If a pending action exists but the corresponding alarm is missing, the watchdog is recreated.

---

# Tab reload recovery

The content script sends:

```text
CONTENT_READY
```

when it loads.

If an active automation belongs to that tab, the service worker can request a new page scan.

The page handler determines whether the current search-result page is the same as the persisted page.

When possible, the existing target index and counters are preserved.

This allows the automation to recover from:

```text
tab reload
content-script reload
service-worker restart
```

without always starting a completely new run.

---

# Popup dashboard

The popup provides a compact control panel for the automation.

It displays:

```text
status
current page
target progress
sent
skipped
failed
daily remaining
weekly remaining
```

It also provides:

```text
Start
Stop / Pause
Resume
Save limits
Clear log
```

The controls react to the current state.

For example:

```text
running → Start disabled
paused  → Start becomes Resume
```

---

# Persistent event log

User-facing events are stored separately from the main automation state.

Examples include:

```text
New automation run started

Automation paused on page 2, target 4

Automation resumed from page 2, target 4

Invitation sent to John Doe

Skipped Jane Doe: verification required

Local daily invitation limit reached

LinkedIn weekly invitation limit reached

Automation run finished
```

Only a limited recent history is retained.

Keeping the event log separate from the main automation state also avoids unnecessary state-object contention between independent asynchronous writes.

---

# Trusted input

## Problem

Calling a DOM element directly:

```js
element.click();
```

or manually dispatching a mouse event:

```js
element.dispatchEvent(
  new MouseEvent('click')
);
```

produces a synthetic event.

Such events have:

```js
event.isTrusted === false
```

This makes direct DOM interaction distinguishable from input that passes through the browser's input pipeline.

---

## Approaches considered

I considered three possible approaches.

### 1. DOM `click()` / `dispatchEvent()`

This is the simplest implementation, but it produces synthetic events with:

```js
event.isTrusted === false
```

For that reason it was not suitable for this task.

---

### 2. Chrome Debugger API + Chrome DevTools Protocol

A Manifest V3 extension can attach to a tab using:

```js
chrome.debugger.attach()
```

and send Chrome DevTools Protocol commands with:

```js
chrome.debugger.sendCommand()
```

Mouse input can then be dispatched using the CDP:

```text
Input.dispatchMouseEvent
```

command.

The content script is responsible for locating the target DOM element and obtaining its coordinates using:

```js
getBoundingClientRect()
```

The coordinates are sent to the extension service worker, which owns the `chrome.debugger` interaction.

The input sequence used in the proof of concept was:

```text
mouseMoved
→ mousePressed
→ mouseReleased
```

This produced a normal click event on the test target with:

```js
event.isTrusted === true
```

I verified this explicitly with a click listener on a controlled test page.

---

### 3. Native Messaging + OS-level input

Another possible solution is a Native Messaging host combined with OS-level mouse control such as RobotJS, xdotool or platform-native input APIs.

This can generate input at the operating-system level, but introduces substantial deployment complexity because an additional native component must be installed outside the Chrome extension.

For this assignment I considered that trade-off unnecessary.

---

## Selected approach

I selected:

**Chrome Debugger API + CDP**

It provides the required trusted browser input while keeping the implementation inside the Chrome extension architecture and avoiding an additional native host.

The relevant architecture is:

```text
Content Script
    │
    │ locate target
    │ getBoundingClientRect()
    ▼
{x, y}
    │
    │ chrome.runtime messaging
    ▼
Service Worker
    │
    │ chrome.debugger
    ▼
Chrome DevTools Protocol
    │
    │ Input.dispatchMouseEvent
    ▼
Browser input pipeline
```

The proof of concept confirmed:

```text
event.isTrusted === true
```

for the resulting click.

---

## `isTrusted` is not sufficient

`isTrusted === true` should not be interpreted as making the automation indistinguishable from human interaction.

It addresses only one observable property of the generated input.

A web application may also evaluate broader behavioral and server-side signals, including:

- timing and regularity of actions;
- interaction history before an action;
- scrolling, focus and hover behavior;
- application telemetry generated during normal UI interaction;
- action frequency and rate limits;
- account history and reputation;
- ratios between invitations sent, pending and accepted.

For this reason this implementation does **not** claim to be undetectable.

The goal is to use the normal browser input path required by the assignment while keeping automation behavior explicit and rate-limited.

---

## `chrome.debugger` limitation

Using:

```js
chrome.debugger
```

causes Chrome to display a visible notification indicating that the extension is debugging the browser.

This is an inherent UX limitation of the selected approach.

Suppressing this browser indication through special Chrome startup flags would require control over how the browser is launched and is therefore not considered an appropriate production solution for a normal Chrome extension.

For a production system where this limitation is unacceptable, a different architecture — for example a controlled browser environment or a Native Messaging based solution — would need to be evaluated.

---

# Known limitations

## English LinkedIn UI

The current target and modal resolution logic uses several English LinkedIn strings, including values such as:

```text
Invite ... to connect
Pending
Message
Follow
More
Send without a note
How do you know
Next
```

The implementation therefore currently targets the **English LinkedIn UI**.

Where possible, the extension prefers more stable signals such as:

```text
data-testid
role
href
aria-current
profile URLs
```

but complete locale independence has not been implemented.

A production version should move remaining text matching behind locale-aware matchers.

---

## LinkedIn DOM changes

LinkedIn is a dynamically evolving web application.

Selectors and shadow-DOM structures may change over time.

The implementation intentionally avoids generated CSS class names where practical, but any UI automation tied to a third-party DOM requires maintenance.

---

## Trusted input is not undetectability

The trusted-input proof of concept verifies that events generated through CDP reach the page with:

```js
event.isTrusted === true
```

It does not imply that the complete automation cannot be detected through behavioral, client-side or server-side signals.

Trusted input is treated as one engineering requirement rather than as a complete anti-detection mechanism.

---

## Chrome Debugger UI

Chrome displays a visible debugging notification while the extension is attached through:

```js
chrome.debugger
```

This is expected behavior.

---

## Search availability

The extension depends on LinkedIn exposing normal People Search result cards.

If the account is subject to a LinkedIn search restriction or search-result limit, the extension may have no actionable targets to process.

---

# Privacy and storage

Automation state is stored locally through:

```js
chrome.storage.local
```

The extension does not require an external backend for its current implementation.

Locally persisted data includes:

```text
automation state
invitation timestamps
rate-limit configuration
recent event log
```

---

# Permissions

The extension currently requests:

```json
[
  "activeTab",
  "debugger",
  "storage",
  "alarms"
]
```

Their purposes are:

| Permission | Purpose |
|---|---|
| `activeTab` | access to the currently selected LinkedIn tab |
| `debugger` | trusted browser input through CDP |
| `storage` | persistent automation state, counters and limits |
| `alarms` | recovery of delayed actions after MV3 worker suspension |

Content scripts are limited to:

```text
https://www.linkedin.com/*
```

rather than being injected into unrelated websites.

---

# Demo checklist

A final demonstration should show:

1. extension installation;
2. LinkedIn People Search page;
3. popup configuration;
4. automation start;
5. discovered targets;
6. trusted input through CDP;
7. explicit proof that the resulting event has:

```js
event.isTrusted === true
```

8. invitation modal handling;
9. successful connection invitations;
10. live sent / skipped / failed counters;
11. recent event log;
12. pause;
13. resume;
14. service-worker / reload recovery;
15. pagination where available.

The assignment demonstration should include at least five controlled successful invitations if the test account allows them.

---

# Development notes

The project intentionally favors conservative failure behavior.

When the extension encounters a condition it cannot safely interpret, the preferred behavior is:

```text
stop
→ preserve state
→ log diagnostic information
```

rather than guessing which UI action to execute.

This applies particularly to:

```text
unknown modals
missing target coordinates
rate-limit conditions
unexpected pagination states
```

---

# Disclaimer

This project demonstrates browser-extension architecture, DOM automation, trusted browser input, persistence and MV3 recovery.

Users are responsible for ensuring that any use of automation complies with the rules and policies of the platforms they interact with.