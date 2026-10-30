// Metro service worker. Do not edit.
importScripts("/controller/controller.sw.js");

addEventListener("fetch", (e) => {
	if ($scramjetController.shouldRoute(e)) {
		e.respondWith($scramjetController.route(e));
	}
});
