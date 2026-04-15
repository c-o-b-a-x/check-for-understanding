function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function getMainText() {
  const blockedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "CANVAS"]);
  const candidates = [
    document.querySelector("main"),
    document.querySelector("article"),
    document.querySelector("[role='main']"),
    document.body,
  ].filter(Boolean);

  const root = candidates[0] || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || blockedTags.has(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      const text = cleanText(node.textContent);
      if (!text || text.length < 25) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const chunks = [];
  while (walker.nextNode()) {
    chunks.push(cleanText(walker.currentNode.textContent));
    if (chunks.join("\n").length > 18000) {
      break;
    }
  }

  return chunks.join("\n");
}

function collectHeadings() {
  return Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((node) => cleanText(node.textContent))
    .filter(Boolean)
    .slice(0, 20);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "extract-page-content") {
    return;
  }

  sendResponse({
    ok: true,
    payload: {
      title: cleanText(document.title),
      url: window.location.href,
      headings: collectHeadings(),
      text: getMainText(),
    },
  });
});
