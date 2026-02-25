// assets/js/global_scripts.js
(function () {
  "use strict";
  // -----------------------------
  // Google Analytics (GA4)
  // -----------------------------
  function loadGoogleAnalytics() {
    // Create and load the gtag script
    var gaScript = document.createElement("script");
    gaScript.async = true;
    gaScript.src = "https://www.googletagmanager.com/gtag/js?id=G-GLYLC0QSVQ";
    document.head.appendChild(gaScript);
    // Initialize dataLayer + gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", "G-GLYLC0QSVQ");
    console.log("[tracking] Google Analytics loaded");
  }
  // -----------------------------
  // Meta Pixel
  // -----------------------------
  function loadMetaPixel() {
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(
      window,
      document,
      "script",
      "https://connect.facebook.net/en_US/fbevents.js"
    );
    // assign pixel ID and track page view
    fbq("init", "1648971006194004");
    fbq("track", "PageView");
    console.log("[tracking] Meta Pixel loaded");
  }
  // Run both
  loadGoogleAnalytics();
  loadMetaPixel();
})();