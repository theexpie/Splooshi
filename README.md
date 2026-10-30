# Splooshi

Splooshi is a browser-style front end for a Scramjet-based web proxy. It features a Safari-inspired liquid-glass interface, the project's blue droplet mascot, optional interface sounds, and a diagnostics panel.

Splooshi is an independent project. It is not made by, affiliated with, or endorsed by Apple. References to iOS design describe the visual inspiration only.

## Features

- Safari-inspired liquid-glass interface.
- Original blue droplet mascot embedded in `index.svg`.
- Optional interface sounds generated with the Web Audio API.
- Diagnostics for asset loading, service-worker status, navigation failures, and JavaScript errors.
- Error reports that can be copied or downloaded.
- A start screen without simulated loading indicators or decorative telemetry.

## Project files

Keep these files together in the published folder. Preserve their filenames and relative paths.

| File | Purpose |
|---|---|
| `index.svg` | Application entrypoint, interface, mascot, sounds, and diagnostics. |
| `sw.js` | Service worker and worker-side error reporting. |
| `controller.sw.js` | Scramjet service-worker controller. |
| `controller.api.js` | Scramjet controller API. |
| `controller.inject.js` | Scramjet page-injection code. |
| `scramjet.js` | Scramjet runtime bundle. |
| `scramjet-utils.js` | Runtime utilities. |
| `scramjet.wasm` | WebAssembly runtime asset. |
| `libcurl-client.js` | WebSocket/Wisp transport client. |
| `README.md` | Project documentation. |

Use files from the same compatible Scramjet build. Mixing versions can prevent the proxy from starting.

## Running locally

Service workers require a secure context. `localhost` qualifies, so use a local web server rather than opening the SVG directly from disk.

1. Put the project files in one folder.
2. Open a terminal in that folder.
3. Run:

   ```bash
   python -m http.server 8000
   ```

4. Open `http://localhost:8000/index.svg` in a normal browser tab.
5. If startup fails, open **Logs** and check the first relevant error.

## Publishing on GitHub and JSDelivr

1. Create a public GitHub repository.
2. Upload the project files, keeping their relative paths intact.
3. Commit the files.
4. Open the following URL in a normal HTTPS browser tab, replacing the placeholders:

   ```text
   https://cdn.jsdelivr.net/gh/YOUR-USERNAME/YOUR-REPOSITORY@main/index.svg
   ```

5. If the service worker activates but does not control the tab, reload the page and check **Logs**.

GitHub Pages is not required for JSDelivr. Using a version tag or commit reference instead of `@main` makes deployments more predictable.

### Deployment notes

`index.svg` is the application entrypoint, not a self-contained proxy engine. The companion runtime files must also be available at the paths expected by the application.

Open the SVG as a top-level document. Embedding it in an image element does not provide the same service-worker behavior.

Successful uploads do not guarantee that the proxy will work. Service-worker scope, response headers, MIME types, browser restrictions, runtime compatibility, and the transport endpoint can all affect operation.

## Diagnostics

Open **Logs** or press **Ctrl + Shift + L**. On macOS, try **Command + Shift + L**.

The panel can report:

- Asset requests and HTTP status codes.
- Service-worker registration and initialization.
- Navigation attempts and failures.
- JavaScript errors and unhandled promise rejections.
- Worker-side warnings and errors.

Use the available filters to narrow the results. Reports can be copied or downloaded. Start with the earliest relevant error, since later errors may be consequences of the original failure.

### Common issues

| Problem | What to check |
|---|---|
| An asset returns `404` | Check the filename, capitalization, directory, and requested path. |
| Service workers are unavailable | Use a top-level HTTPS page or `localhost`. |
| The controller API is missing | Check for failed script requests or incompatible runtime files. |
| Pages fail to load | Check the navigation logs and transport endpoint. |
| The application works only after refreshing | The service worker may not have controlled the first page load. |
| Changes do not appear | Check the repository branch or commit and account for CDN caching. |

## Sounds and settings

Interface sounds are generated in the browser, so separate audio files are not required. Some browsers require user interaction before audio can play.

Disable **Interface sounds** in Settings to turn them off.

Settings also provide access to diagnostics and the available about:blank cloak options. Cloaking changes how a page is opened; it does not guarantee anonymity or prevent network monitoring.

## Privacy and logs

Diagnostics are stored in `sessionStorage` for the current tab session and limited to the latest 250 entries. Query strings and URL fragments are removed from navigation URLs before they are logged.

Reports may still contain page paths, origins, browser capabilities, error messages, and stack traces. Review reports before sharing them publicly.

Do not enter passwords or other sensitive account information into a proxy you do not trust. Review the source code and external services you use.

The default transport endpoint is configured in `index.svg`:

```js
const WISP = "wss://wisp.mercurywork.shop/";
```

Proxy navigation depends on a reachable, compatible transport endpoint. This external service can change independently of the project. Use another endpoint only if it is compatible with the runtime.

## Limitations

- Splooshi is not the Apple Safari browser.
- ***Some*** websites may not work.
- The SVG entrypoint does not contain the entire Scramjet runtime.
- Cloak options do not guarantee anonymity.
- Static checks do not prove that a live deployment works correctly.

Test the hosted version in the target browser. Service-worker routing, WebAssembly loading, and remote transport behavior need to be checked in the actual deployment environment.

## Contributing

When reporting a bug, include:

1. What you tried to open or click.
2. What you expected to happen.
3. What happened instead.
4. The first relevant error from **Logs**, with private information removed.
5. Your browser and whether you tested locally or on JSDelivr.

Preserve the notices and licenses for Scramjet, its dependencies, the transport service, and other redistributed components.

## Credits

- **Project:** Splooshi
- **Mascot:** The project's blue droplet character, based on the creator's Canva artwork.
- **Proxy engine:** Scramjet and its bundled runtime components.
- **Visual design:** Safari-inspired liquid-glass interface.

Splooshi is an independent project and is not affiliated with Apple. Follow the applicable licenses and terms for the project, its dependencies, external services, and websites you access.
