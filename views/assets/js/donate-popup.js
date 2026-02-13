(function () {
  const url = "https://www.zeffy.com/en-US/donation-form/donate-to-help-us-bring-rational-politics-back";

  const features = [
    "popup=yes",
    "width=900",
    "height=950",
    "left=120",
    "top=80",
    "resizable=yes",
    "scrollbars=yes"
  ].join(",");

  function attachDonatePopup() {
    const donateLink = document.getElementById("donateLink");
    if (!donateLink) return;

    donateLink.addEventListener("click", function (e) {
      e.preventDefault();

      const w = window.open(url, "zeffyDonate", features);

      // Fallback if popup blocked
      if (!w) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  // Safe whether the script is loaded in <head> or end of <body>
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachDonatePopup);
  } else {
    attachDonatePopup();
  }
})();
