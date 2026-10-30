// Splooshi service worker entrypoint. The Scramjet worker is stored beside this file.
importScripts("./controller.sw.js");

addEventListener("fetch", (event) => {
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
  }
});
