/* Metro engine. DO NOT EDIT. The UI talks to this only through window.MetroEngine.
 *
 * API
 *   await MetroEngine.start({ iframe, wisp, transport })  -> boots everything, throws a readable Error on failure
 *   MetroEngine.go(url)            navigate the frame (full URL, e.g. https://example.com)
 *   MetroEngine.back() / forward() / reload()
 *   MetroEngine.resolve(input, searchTemplate)  -> full URL from typed text; searchTemplate uses %s
 *   await MetroEngine.setWisp(url)           switch Wisp server live
 *   await MetroEngine.setTransport(name)     "libcurl" or "epoxy"
 *   await MetroEngine.testWisp(url)          -> true/false, checks the websocket opens
 *   MetroEngine.onUrl = (url) => {}          fires when the proxied page URL changes
 *   MetroEngine.onLog = (line) => {}         fires for every startup/debug line
 *   MetroEngine.log                          array of all log lines so far
 *   MetroEngine.status                       "idle" | "starting" | "ready" | "error"
 *   MetroEngine.controller / .frame          raw objects (advanced settings only)
 */
(() => {
	const PATHS = {
		sw: "/sw.js",
		bundle: "/scram/scramjet.js",
		wasm: "/scram/scramjet.wasm",
		utils: "/scram/scramjet-utils.js",
		api: "/controller/controller.api.js",
		inject: "/controller/controller.inject.js",
		swController: "/controller/controller.sw.js",
		libcurl: "/clients/libcurl-client.js",
		epoxy: "/clients/epoxy-client.js",
	};

	const E = {
		status: "idle",
		log: [],
		onUrl: null,
		onLog: null,
		controller: null,
		frame: null,
		wisp: "wss://wisp.mercurywork.shop/",
		transportName: "libcurl",
	};

	function log(msg) {
		const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
		E.log.push(line);
		console.log("[metro]", msg);
		try {
			if (typeof E.onLog === "function") E.onLog(line);
		} catch (_) {}
	}

	function fail(msg) {
		E.status = "error";
		log("ERROR: " + msg);
		throw new Error(msg);
	}

	function loadScript(src) {
		return new Promise((resolve, reject) => {
			const s = document.createElement("script");
			s.src = src;
			s.onload = () => resolve();
			s.onerror = () => reject(new Error("Could not load " + src));
			document.head.appendChild(s);
		});
	}

	// Hosts often answer a missing file with index.html. Catch that here with a clear message.
	async function preflight(needEpoxy) {
		const jsFiles = [
			PATHS.sw,
			PATHS.bundle,
			PATHS.utils,
			PATHS.api,
			PATHS.inject,
			PATHS.swController,
			E.transportName === "epoxy" || needEpoxy ? PATHS.epoxy : PATHS.libcurl,
		];
		const missing = [];
		for (const p of jsFiles) {
			try {
				const r = await fetch(p, { cache: "no-store" });
				const ct = (r.headers.get("content-type") || "").toLowerCase();
				if (!r.ok || ct.includes("text/html")) missing.push(p);
			} catch (_) {
				missing.push(p);
			}
		}
		try {
			const r = await fetch(PATHS.wasm, { cache: "no-store" });
			const b = new Uint8Array(await r.arrayBuffer());
			const ok = r.ok && b[0] === 0 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d;
			if (!ok) missing.push(PATHS.wasm);
		} catch (_) {
			missing.push(PATHS.wasm);
		}
		if (missing.length) {
			fail(
				"These engine files are missing or not served as real files: " +
					missing.join(", ") +
					". Upload them at exactly these paths."
			);
		}
		log("All engine files found");
	}

	async function getServiceWorker() {
		if (!("serviceWorker" in navigator)) {
			fail("This browser or page does not allow service workers (needs https and a normal, non-sandboxed page).");
		}
		let reg;
		try {
			reg = await navigator.serviceWorker.register(PATHS.sw, { scope: "/" });
		} catch (e) {
			fail("Service worker registration failed: " + (e && e.message ? e.message : e));
		}
		log("Service worker registered");

		if (!navigator.serviceWorker.controller) {
			await Promise.race([
				navigator.serviceWorker.ready.then(() => {}),
				new Promise((res) =>
					navigator.serviceWorker.addEventListener("controllerchange", () => res(), { once: true })
				),
				new Promise((res) => setTimeout(res, 10000)),
			]);
		}
		const sw = navigator.serviceWorker.controller || reg.active;
		if (!sw) fail("Service worker did not become active. Reload the page once and try again.");
		log("Service worker active");
		return sw;
	}

	const clientClasses = {};

	function makeTransport(name, wisp) {
		const C = clientClasses[name];
		if (!C) fail("Transport '" + name + "' is not loaded.");
		// pass both option names so either library version works
		return new C({ wisp, websocket: wisp });
	}

	async function ensureTransportScript(name) {
		if (clientClasses[name]) return;
		const src = name === "epoxy" ? PATHS.epoxy : PATHS.libcurl;
		const globalName = name === "epoxy" ? "EpoxyTransport" : "LibcurlTransport";
		const className = name === "epoxy" ? "EpoxyClient" : "LibcurlClient";
		let C = window[globalName] && window[globalName][className];
		if (!C) {
			try {
				await loadScript(src);
			} catch (_) {}
			C = window[globalName] && window[globalName][className];
		}
		if (!C) {
			// the file may be an ES module instead of a browser-global script
			try {
				const m = await import(src);
				C = m[className] || (m.default && (m.default[className] || m.default));
			} catch (e) {
				log("Module import of " + src + " failed: " + (e && e.message ? e.message : e));
			}
		}
		if (typeof C !== "function") {
			fail("Could not find " + className + " in " + src + ". The file may be the wrong one (use the package's dist/index.js).");
		}
		clientClasses[name] = C;
		log("Loaded " + name + " transport");
	}

	E.start = async function (opts) {
		if (E.status === "starting") return;
		opts = opts || {};
		if (!opts.iframe) fail("start() needs { iframe }");
		E.status = "starting";
		if (opts.wisp) E.wisp = opts.wisp;
		if (opts.transport) E.transportName = opts.transport;
		log("Starting engine");

		await preflight(false);
		const sw = await getServiceWorker();

		try {
			await loadScript(PATHS.bundle);
			await loadScript(PATHS.api);
			await loadScript(PATHS.utils);
			log("Scramjet scripts loaded");
		} catch (e) {
			fail(e.message);
		}

		const api = window.$scramjetController;
		const utils = window.$scramjetUtils;
		if (!api || !api.Controller) fail("controller.api.js loaded but $scramjetController is missing.");
		if (!utils) fail("scramjet-utils.js loaded but $scramjetUtils is missing.");

		api.config.injectPath = PATHS.inject;
		api.config.wasmPath = PATHS.wasm;
		api.config.scramjetPath = PATHS.bundle;

		try {
			await ensureTransportScript(E.transportName);
		} catch (e) {
			fail(e.message);
		}
		const transport = makeTransport(E.transportName, E.wisp);
		log("Transport created (" + E.transportName + ", " + E.wisp + ")");

		try {
			E.controller = new api.Controller({ serviceworker: sw, transport });
			await E.controller.wait();
		} catch (e) {
			fail("Controller failed to start: " + (e && e.message ? e.message : e));
		}
		log("Controller ready");

		try {
			E.frame = E.controller.createFrame(opts.iframe, {
				plugins: [
					new utils.HttpCachePlugin(),
					new utils.UrlWatcherPlugin((url) => {
						try {
							if (typeof E.onUrl === "function") E.onUrl(String(url));
						} catch (_) {}
					}),
					new utils.CatchEscapedLinksPlugin(
						(url) => new URL("/?goto=" + encodeURIComponent(url.href), location.origin)
					),
				],
			});
		} catch (e) {
			fail("Frame creation failed: " + (e && e.message ? e.message : e));
		}
		log("Frame ready");
		E.status = "ready";

		const goto = new URL(location.href).searchParams.get("goto");
		if (goto) {
			history.replaceState(null, "", location.pathname);
			E.go(goto);
		}
	};

	E.go = function (url) {
		if (E.status !== "ready") fail("Engine is not ready yet.");
		if (!/^https?:\/\//i.test(url)) url = "https://" + url;
		log("Navigate: " + url);
		return E.frame.go(url);
	};
	E.back = () => E.frame && E.frame.back();
	E.forward = () => E.frame && E.frame.forward();
	E.reload = () => E.frame && E.frame.reload();

	E.resolve = function (input, searchTemplate) {
		input = (input || "").trim();
		if (!input) return "";
		if (/^https?:\/\//i.test(input)) return input;
		const looksLikeHost = /^[^\s/]+\.[a-z]{2,}([/:?#].*)?$/i.test(input) || /^localhost(:\d+)?([/?#].*)?$/i.test(input);
		if (looksLikeHost && !/\s/.test(input)) return "https://" + input;
		const t = searchTemplate || "https://duckduckgo.com/?q=%s";
		return t.replace("%s", encodeURIComponent(input));
	};

	E.setWisp = async function (url) {
		E.wisp = url;
		if (E.status !== "ready") return;
		const t = makeTransport(E.transportName, url);
		await E.controller.setTransport(t);
		log("Wisp changed to " + url);
	};

	E.setTransport = async function (name) {
		if (name !== "libcurl" && name !== "epoxy") fail("Unknown transport: " + name);
		await ensureTransportScript(name);
		E.transportName = name;
		if (E.status !== "ready") return;
		await E.controller.setTransport(makeTransport(name, E.wisp));
		log("Transport changed to " + name);
	};

	E.testWisp = function (url) {
		return new Promise((resolve) => {
			let done = false;
			const finish = (v) => {
				if (done) return;
				done = true;
				try {
					ws.close();
				} catch (_) {}
				resolve(v);
			};
			let ws;
			try {
				ws = new WebSocket(url);
			} catch (_) {
				return resolve(false);
			}
			ws.onopen = () => finish(true);
			ws.onerror = () => finish(false);
			setTimeout(() => finish(false), 6000);
		});
	};

	window.MetroEngine = E;
})();
