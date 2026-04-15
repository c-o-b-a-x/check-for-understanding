function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSelectedText() {
  const selection = window.getSelection?.();
  if (!selection) {
    return "";
  }
  return cleanText(selection.toString());
}

function isVisible(element) {
  if (!element) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function collectHeadings() {
  return Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((node) => cleanText(node.textContent))
    .filter(Boolean)
    .slice(0, 20);
}

function scoreNodeText(node) {
  const text = cleanText(node.textContent);
  if (!text || text.length < 40) {
    return null;
  }

  let score = 0;
  if (node.tagName === "ARTICLE") score += 25;
  if (node.tagName === "MAIN") score += 20;
  if (node.tagName === "P") score += 12;
  if (node.tagName === "LI") score += 8;
  if (node.closest("article")) score += 15;
  if (node.closest("main")) score += 10;
  if (node.closest("[role='main']")) score += 8;
  score += Math.min(text.length / 40, 20);

  return { text, score };
}

function dedupeChunks(chunks) {
  const seen = new Set();
  const output = [];
  for (const chunk of chunks) {
    const key = chunk.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(chunk);
  }
  return output;
}

function getMainText() {
  const selectors = "article, main, [role='main'], p, li, blockquote, td";
  const scored = [];

  document.querySelectorAll(selectors).forEach((node) => {
    if (!isVisible(node)) {
      return;
    }
    const result = scoreNodeText(node);
    if (result) {
      scored.push(result);
    }
  });

  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  let totalLength = 0;
  for (const item of scored) {
    if (totalLength > 18000) {
      break;
    }
    selected.push(item.text);
    totalLength += item.text.length;
  }

  return dedupeChunks(selected).join("\n");
}

function getDescription() {
  return cleanText(
    document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[property="og:description"]')?.content ||
      "",
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "extract-page-content") {
    return;
  }

  const selectedText = getSelectedText();
  const text = selectedText.length >= 120 ? selectedText : getMainText();
  const description = getDescription();
  const finalText = [description, text].filter(Boolean).join("\n\n");

  sendResponse({
    ok: Boolean(finalText),
    payload: {
      title: cleanText(document.title),
      url: window.location.href,
      headings: collectHeadings(),
      description,
      sourceType: selectedText.length >= 120 ? "selection" : "page",
      text: finalText,
      stats: {
        characterCount: finalText.length,
        headingCount: collectHeadings().length,
      },
    },
  });
});
