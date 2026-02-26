// assets/js/loader.js
/**
 * This script dynamically loads all other JS files in the correct order, ensuring that dependencies are loaded before the scripts that rely on them. It also waits for the DOM to be ready before loading any scripts that require it.
 */
(async function () {
  "use strict";
  // Ensure DOM exists (because main.js touches #nav and body immediately)
  if (document.readyState === "loading") {
    await new Promise((r) =>
      document.addEventListener("DOMContentLoaded", r, { once: true })
    );
  }
  // variables
  const loadRoot = 'assets/js/';
  const scripts = [
    'jquery.min.js',
    'jquery.dropotron.min.js',
    'browser.min.js',
    'breakpoints.min.js',
    'util.js',
    'main.js',
  ];
  // functions
  function loadScriptOrdered(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = loadRoot + src;
      // dynamic scripts are async by default; force ordered execution
      s.async = false;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error("Failed to load: " + src));
      document.body.appendChild(s);
    });
  }
  // execute
  try {
    for (const src of scripts) {
      await loadScriptOrdered(src);
      console.log("[loaded]", src);
    }
  } catch (e) {
    console.error(e);
  }
})();
