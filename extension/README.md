# Site to Quiz JSON Extension

Chrome extension for turning the current webpage into quiz JSON for this app.

## What it does

- Reads the active page's title, headings, and visible text
- Sends that content to Gemini using a user-provided API key
- Returns JSON in this format:

```json
{
  "quiz": [
    {
      "id": 1,
      "question": "Question text",
      "choices": {
        "correct": "Correct answer",
        "wrong1": "Wrong answer",
        "wrong2": "Wrong answer",
        "wrong3": "Wrong answer"
      }
    }
  ]
}
```

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click `Load unpacked`
4. Select this folder:

## Use it

1. Open a webpage you want to quiz from
2. Open the extension popup
3. Paste your Gemini API key
4. Pick question count and optional focus guidance
5. Click `Generate Quiz JSON`
6. Copy the JSON into the app's admin upload area or download it as a file

## Notes

- The API key is stored locally in the browser extension storage.
- The extension works best on pages with clear article or lesson text.
- Browser internal pages like `chrome://` cannot be read by content scripts.
