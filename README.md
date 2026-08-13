## Trusted input

### Problem

Calling a DOM element directly:

```js
element.click();
```

or manually dispatching a mouse event:

```js
element.dispatchEvent(new MouseEvent('click'));
```

produces a synthetic event. Such events have:

```js
event.isTrusted === false
```

This makes direct DOM interaction distinguishable from input that passes through the browser's input pipeline.

### Approaches considered

I considered three possible approaches.

#### 1. DOM `click()` / `dispatchEvent()`

This is the simplest implementation, but it produces synthetic events with `isTrusted === false`.

For that reason it was not suitable for this task.

#### 2. Chrome Debugger API + Chrome DevTools Protocol

A Manifest V3 extension can attach to a tab using:

```js
chrome.debugger.attach()
```

and send Chrome DevTools Protocol commands with:

```js
chrome.debugger.sendCommand()
```

Mouse input can then be dispatched using the CDP `Input.dispatchMouseEvent` command.

The content script is responsible for locating the target DOM element and obtaining its coordinates using `getBoundingClientRect()`.

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

#### 3. Native Messaging + OS-level input

Another possible solution is a Native Messaging host combined with OS-level mouse control such as RobotJS, xdotool or platform-native input APIs.

This can generate input at the operating-system level, but introduces substantial deployment complexity because an additional native component must be installed outside the Chrome extension.

For this assignment I considered that trade-off unnecessary.

### Selected approach

I selected **Chrome Debugger API + CDP**.

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

### `isTrusted` is not sufficient

`isTrusted === true` should not be interpreted as making the automation indistinguishable from human interaction.

It addresses only one observable property of the generated input.

A web application may also evaluate broader behavioral and server-side signals, including:

* timing and regularity of actions;
* interaction history before an action;
* scrolling, focus and hover behavior;
* application telemetry generated during normal UI interaction;
* action frequency and rate limits;
* account history and reputation;
* ratios between invitations sent, pending and accepted.

For this reason this implementation does **not** claim to be undetectable.

The goal is to use the normal browser input path required by the assignment while keeping automation behavior explicit and rate-limited.

### `chrome.debugger` limitation

Using `chrome.debugger` causes Chrome to display a visible notification indicating that the extension is debugging the browser.

This is an inherent UX limitation of the selected approach.

Suppressing this browser indication through special Chrome startup flags would require control over how the browser is launched and is therefore not considered an appropriate production solution for a normal Chrome extension.

For a production system where this limitation is unacceptable, a different architecture — for example a controlled browser environment or a Native Messaging based solution — would need to be evaluated.

### Known limitations

The trusted-input proof of concept verifies that events generated through CDP reach the page with `isTrusted === true`.

It does not imply that the complete automation cannot be detected through behavioral, client-side or server-side signals.

The implementation intentionally treats trusted input as one engineering requirement rather than as a complete anti-detection mechanism.
