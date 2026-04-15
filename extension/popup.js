const STORAGE_KEY = "geminiApiKey";
const MODEL = "gemini-2.5-flash";

const apiKeyInput = document.getElementById("apiKey");
const questionCountInput = document.getElementById("questionCount");
const difficultyInput = document.getElementById("difficulty");
const focusPromptInput = document.getElementById("focusPrompt");
const generateBtn = document.getElementById("generateBtn");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const pageMetaEl = document.getElementById("pageMeta");

let latestQuizJson = "";
let activeTab = null;

init().catch((error) => {
  setStatus(error.message || "Failed to initialize popup.", true);
});

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (stored?.[STORAGE_KEY]) {
    apiKeyInput.value = stored[STORAGE_KEY];
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  activeTab = tab || null;
  if (!activeTab?.id || !activeTab.url) {
    pageMetaEl.textContent = "No active tab found.";
    return;
  }

  pageMetaEl.textContent = `${activeTab.title || "Untitled"}\n${activeTab.url}`;
}

generateBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const questionCount = Number(questionCountInput.value || 5);
  const difficulty = difficultyInput.value;
  const focusPrompt = focusPromptInput.value.trim();

  if (!apiKey) {
    setStatus("Enter a Gemini API key first.", true);
    apiKeyInput.focus();
    return;
  }

  if (!activeTab?.id || !activeTab.url) {
    setStatus("Open a normal webpage before generating.", true);
    return;
  }

  generateBtn.disabled = true;
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  setStatus("Reading the page and generating quiz JSON...");

  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: apiKey });
    const page = await extractPage(activeTab.id);
    const quizJson = await generateQuizJson({
      apiKey,
      page,
      questionCount: Math.min(Math.max(questionCount, 1), 15),
      difficulty,
      focusPrompt,
    });

    latestQuizJson = JSON.stringify(quizJson, null, 2);
    outputEl.textContent = latestQuizJson;
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    setStatus(`Generated ${quizJson.quiz.length} questions.`, false, true);
  } catch (error) {
    setStatus(error.message || "Failed to generate quiz JSON.", true);
  } finally {
    generateBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  if (!latestQuizJson) {
    return;
  }

  await navigator.clipboard.writeText(latestQuizJson);
  setStatus("Quiz JSON copied to clipboard.", false, true);
});

downloadBtn.addEventListener("click", () => {
  if (!latestQuizJson) {
    return;
  }

  const blob = new Blob([latestQuizJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const link = document.createElement("a");
  link.href = url;
  link.download = `quiz-${timestamp}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Download started.", false, true);
});

async function extractPage(tabId) {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: "extract-page-content",
  });

  if (!response?.ok || !response.payload?.text) {
    throw new Error(
      "I could not read enough content from this page. Try a text-heavy article or refresh the tab first.",
    );
  }

  return response.payload;
}

async function generateQuizJson({
  apiKey,
  page,
  questionCount,
  difficulty,
  focusPrompt,
}) {
  const prompt = [
    "You create multiple-choice quiz JSON for a classroom app.",
    "Return only valid JSON with this exact top-level shape:",
    '{"quiz":[{"id":1,"question":"...","choices":{"correct":"...","wrong1":"...","wrong2":"...","wrong3":"..."}}]}',
    `Create exactly ${questionCount} questions.`,
    `Difficulty: ${difficulty}.`,
    "Rules:",
    "- Base every question on the provided page content.",
    "- Questions should check understanding, not trivial wording recall.",
    "- Each question must have exactly 1 correct answer and 3 plausible wrong answers.",
    "- Keep answers concise.",
    "- Do not include markdown fences or commentary.",
    focusPrompt ? `Extra focus: ${focusPrompt}` : "",
    "",
    `Page title: ${page.title}`,
    `Page URL: ${page.url}`,
    `Headings: ${page.headings.join(" | ")}`,
    "Page content:",
    page.text,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini request failed (${response.status}). ${trimError(errorText)}`,
    );
  }

  const data = await response.json();
  const modelText = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!modelText) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsed = validateQuizJson(parseJson(modelText));
  return parsed;
}

function parseJson(value) {
  const cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

function validateQuizJson(data) {
  const quiz = Array.isArray(data?.quiz) ? data.quiz : null;
  if (!quiz?.length) {
    throw new Error(
      "The generated response did not include a non-empty quiz array.",
    );
  }

  const normalizedQuiz = quiz.map((item, index) => {
    const question = String(item?.question || "").trim();
    const choices = item?.choices || {};
    const correct = String(choices.correct || "").trim();
    const wrong1 = String(choices.wrong1 || "").trim();
    const wrong2 = String(choices.wrong2 || "").trim();
    const wrong3 = String(choices.wrong3 || "").trim();

    if (!question || !correct || !wrong1 || !wrong2 || !wrong3) {
      throw new Error(`Question ${index + 1} is missing required fields.`);
    }

    const uniqueChoices = new Set([correct, wrong1, wrong2, wrong3]);
    if (uniqueChoices.size !== 4) {
      throw new Error(`Question ${index + 1} has duplicate answer choices.`);
    }

    return {
      id: index + 1,
      question,
      choices: {
        correct,
        wrong1,
        wrong2,
        wrong3,
      },
    };
  });

  return { quiz: normalizedQuiz };
}

function trimError(errorText) {
  return String(errorText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function setStatus(message, isError = false, isOk = false) {
  statusEl.textContent = message;
  statusEl.classList.remove("error", "ok");
  if (isError) {
    statusEl.classList.add("error");
  } else if (isOk) {
    statusEl.classList.add("ok");
  }
}
