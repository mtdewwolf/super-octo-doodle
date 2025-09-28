# Super Octo Doodle - Gemini Thumbnail Lab

Super Octo Doodle is a Next.js playground for rapid thumbnail iteration on top of Google's Gemini image API. Upload any base image, describe the edit you want, and the app sends your prompt plus the current thumbnail to Gemini. The freshest result becomes the new working image so you can tweak, regenerate, and polish in a tight loop, while a history reel keeps every version within reach.

## Highlights
- Guided upload workflow with live preview and status messaging.
- Gemini integration (client-side form posts to a serverless route that calls @google/genai).
- Automatic hand-off: the first Gemini variant gets promoted to the current image so the next prompt starts from the latest look.
- Glassmorphism UI with a compact notes panel for Gemini prose and a horizontally-scrollable history strip.
- History tap-to-reuse: click any prior render to bring it back as the editable base.
- CLI helper script for local experimentation without the UI.

## System Architecture
`
Browser (React form)
    ¦  ? multipart POST (thumbnail + instructions)
Next.js API route (/api/upload)
    ¦  ? GoogleGenAI.generateContent(model="gemini-2.5-flash-image-preview")
    ¦  ? Gemini inline image + notes
Browser updates state (preview, history, notes)
`

## Getting Started
1. Clone the repo
   `ash
   git clone https://github.com/mtdewwolf/super-octo-doodle.git
   cd super-octo-doodle
   `
2. Install dependencies
   `ash
   npm install
   `
3. Configure environment variables
   Create .env.local in the project root:
   `ini
   GEMINI_API_KEY=your_google_gemini_key
   GEMINI_IMAGE_MODEL=gemini-2.5-flash-image-preview
   # Optional: path used by the CLI helper when you want a default image
   # GEMINI_SEED_IMAGE_PATH=assets/sample-input.png
   `
4. Run the dev server
   `ash
   npm run dev
   `
5. Open http://localhost:3000 and start iterating.

## Usage Flow
1. Choose Thumbnail - upload a PNG, JPG, or WEBP. The app produces a preview and seeds the history timeline.
2. Provide instructions - for example make the horse pink with a cosmic background.
3. Submit - the UI shows a glassy status card while the API route sends prompt + file to Gemini.
4. Review results - each inline image returned is rendered and stored; the first image is automatically converted back to a File and becomes the active base.
5. Iterate - adjust the prompt and submit again, or tap a previous history chip to rewind.

## CLI Helper
For quick experiments outside the UI, use the included Node script:
`ash
node --env-file=.env.local scripts/gemini-generate-image.mjs "Create a cyberpunk nano banana billboard"
`
- Reads GEMINI_API_KEY, GEMINI_IMAGE_MODEL, and optional GEMINI_SEED_IMAGE_PATH.
- Writes responses to the outputs/ directory.
- Pass a prompt via CLI arguments or set GEMINI_PROMPT in your shell.

## Response Shape
The /api/upload route responds with:
`json
{
  "ok": true,
  "message": "Gemini generated a new thumbnail candidate.",
  "prompt": "make the horse pink",
  "notes": ["Gemini commentary..."],
  "images": [
    { "mimeType": "image/png", "data": "...base64..." }
  ]
}
`
Errors surfaced by Gemini (invalid prompt, content policy, etc.) are relayed in the message field and the HTTP status.

## Styling Notes
- Tailwind CSS v4 powers layout utilities.
- Glassmorphism achieved with translucent backgrounds, backdrop blur, and radial gradients.
- History strip uses a custom thin scrollbar defined in src/app/globals.css (.custom-scrollbar).

## Development Scripts
- 
pm run dev - Next.js dev server with hot reload.
- 
pm run build - production build (Turbopack).
- 
pm run start - start the production server.

## Troubleshooting
- 401 or 403 responses: confirm GEMINI_API_KEY is set and valid for the Gemini API.
- Unsupported image format: ensure uploads end in .png, .jpg, .jpeg, or .webp.
- Nothing rendered: Gemini sometimes returns only text notes; adjust the prompt or retry.
- History not updating: check the browser console—failed responses keep the previous state and show the message banner.

## Roadmap Ideas
- Add prompt templates and reusable prompt fragments.
- Persist history to storage so sessions survive reloads.
- Allow multi-image input (style transfer) and mask editing.
- Provide download buttons and shareable links for generated assets.

## License
Add your preferred license here (for example MIT). At the moment the project ships without a formal license file.

---
If you make something wild with Super Octo Doodle, drop a screenshot in an issue or discussion. Enjoy the iterative ride.
