# Site to Quiz JSON Extension

Chrome extension for turning the current webpage into quiz JSON for this app.

## What it does

- Reads the active page's title, headings, description, and visible text
- Prioritizes highlighted text if you select part of a page before opening the popup
- Sends that content to Gemini using a user-provided API key
- Lets you switch between supported text-output Flash models if one is busy
- Returns JSON in this format:
- Can also generate a ready-to-open `/create` URL for this quiz app

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

`C:\Users\cmp_Cohughes\Desktop\code\socket\check for understanding\extension`

## Use it

1. Open a webpage you want to quiz from
2. Optionally highlight the exact section you want the quiz to use
3. Open the extension popup
4. Paste your Gemini API key
5. Pick question count and optional focus guidance
6. Optionally enter a room name, room code, and your quiz app URL
7. Click `Generate Quiz JSON`
8. Copy the JSON into the app's admin upload area, download it, or copy the generated `/create` URL

## Notes

- The popup remembers your last-used settings in browser extension storage.
- The model dropdown is limited to stable text-output Flash models only:
  `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`, and `gemini-2.0-flash-lite`.
- The extension works best on pages with clear article or lesson text.
- Browser internal pages like `chrome://` cannot be read by content scripts.
