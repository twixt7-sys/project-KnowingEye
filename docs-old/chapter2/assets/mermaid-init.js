/** Render Mermaid diagrams after theme is applied. */
(function () {
  function renderMermaid() {
    if (typeof mermaid === "undefined") return;
    const theme = document.documentElement.getAttribute("data-theme") === "light" ? "neutral" : "dark";
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: "loose",
      flowchart: { curve: "basis", htmlLabels: true },
    });
    mermaid.run({ querySelector: ".mermaid" }).catch(function (err) {
      console.warn("Mermaid render:", err);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(renderMermaid, 50);
    });
  } else {
    setTimeout(renderMermaid, 50);
  }

  window.addEventListener("knowing-eye-theme-change", function () {
    document.querySelectorAll(".mermaid").forEach(function (el) {
      el.removeAttribute("data-processed");
    });
    renderMermaid();
  });
})();
