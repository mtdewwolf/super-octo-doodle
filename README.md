# Super Octo Doodle - Gemini Creation Lab

Super Octo Doodle is a Next.js playground for creative work on top of Google's Gemini APIs. Start on the Nano Banana image lab to iterate on thumbnails, jump into the conversational Chat partner for planning and ideation, or use the Math interpreter to transcribe and solve handwritten problems.

## Highlights
- Guided thumbnail workflow with live preview, reference images, and glassmorphism UI.
- Conversational Gemini 2.5 chat with enter-to-send, reset, and persistent history per session.
- Math problem interpreter: upload a photo, confirm transcription, then receive a worked answer and explanation.
- Automatic hand-off: the primary Gemini variant becomes the next editable base image.
- Download/share controls on every generated frame and history entry.
- Toast notifications for lightweight status updates.
- CLI helper script for image generation experiments outside the UI.

## System Architecture
```
Browser (React app)
  +- /          ? Thumbnail lab (image upload + edit form)
  +- /chat      ? Conversational UI
  +- /math      ? Math interpreter

API Routes
  +- /api/upload         ? Gemini image edits (inlineData + notes)
  +- /api/chat           ? Gemini 2.5 text conversations
  +- /api/math/analyze   ? Gemini transcription of math images
  +- /api/math/solve     ? Gemini solves + returns JSON answer/explanation
```

## Getting Started
1. Clone the repo
   ```bash
   git clone https://github.com/mtdewwolf/super-octo-doodle.git
   cd super-octo-doodle
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Configure environment variables by creating `.env.local` in the project root:
   ```ini
   GEMINI_API_KEY=your_google_gemini_key
   # Optional model overrides
   GEMINI_IMAGE_MODEL=gemini-2.5-flash-image-preview
   GEMINI_CHAT_MODEL=gemini-2.5-flash
   GEMINI_CHAT_INSTRUCTION="You are Gemini 2.5 …"
   GEMINI_MATH_MODEL=gemini-2.5-flash
   GEMINI_SOLVER_MODEL=gemini-2.5-flash
   # Optional CLI helpers
   # GEMINI_SEED_IMAGE_PATH=assets/sample-input.png
   ```
4. Run the dev server
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000 and explore the Nano Banana, Chat, or Math workspaces.

## Workspace Overview
### Nano Banana Thumbnail Lab
1. **Choose Base Image** – upload a PNG, JPG, or WEBP. The preview and history timeline update immediately.
2. **Add Reference Images (optional)** – supply up to three style/subject shots to steer Gemini toward composites or transfer effects.
3. **Describe the edit** – e.g., make the horse pink with a cosmic background.
4. **Submit** – Gemini returns variants plus notes; toasts surface status.
5. **Review & iterate** – download/share any render, promote variants via history taps, tweak the prompt, and submit again.

### Gemini Chat Partner
- Two-button nav at the top of the site toggles between Nano Banana, Chat, and Math.
- Chat sends the full conversation to `/api/chat`, which injects default instructions and proxies to Gemini 2.5.
- Enter (without Shift) sends messages; Shift+Enter inserts a newline.
- Reset clears the thread but stays client-side—no backend session state.

### Math Problem Interpreter
1. Upload a math problem image (PNG/JPG/WEBP).
2. Click **Analyze Problem** to have Gemini transcribe the problem into editable text.
3. Confirm or edit the transcription text box.
4. Click **Solve Problem** to receive a final answer plus a step-by-step explanation.
5. The solution card updates with the structured response or an error message.

## Multi-Image & Style Transfer
- Each reference image is bundled into the multipart request and becomes an additional `inlineData` part for Gemini.
- The UI enforces a maximum of three reference files, shows mini previews, and lets you remove individual items before submitting.
- Combine subject and background assets for mashups, or drop a style frame to nudge the final render.

## Download & Share
- Generated images expose **Download** (saves to disk) and **Share Link** (Web Share API with clipboard fallback) buttons.
- History thumbnails include compact DL and Share shortcuts so you can grab any previous frame without promoting it.

## CLI Helper
For quick experiments outside the UI, use the Node script:
```bash
node --env-file=.env.local scripts/gemini-generate-image.mjs "Create a cyberpunk nano banana billboard"
```
- Reads `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, and optional `GEMINI_SEED_IMAGE_PATH`.
- Writes base64 responses to the `outputs/` directory.
- Pass a prompt via CLI arguments or set `GEMINI_PROMPT` in your shell.

## API Responses
`/api/upload` returns:
```json
{
  "ok": true,
  "message": "Gemini generated a new thumbnail candidate.",
  "prompt": "make the horse pink",
  "notes": ["Gemini commentary..."],
  "images": [
    { "mimeType": "image/png", "data": "...base64..." }
  ]
}
```
`/api/chat` and `/api/math/*` follow a similar `{ ok, message?, ...payload }` contract with descriptive error messages and appropriate status codes.

## Styling Notes
- Tailwind CSS (v4) drives layout utilities.
- Glassmorphism: translucent layers with backdrop blur and gradient lighting.
- Toasts, chat bubbles, and math cards live in `src/app/page.tsx`, `src/app/chat/page.tsx`, and `src/app/math/page.tsx`.

## Development Scripts
- `npm run dev` – Next.js dev server with hot reload (Turbopack).
- `npm run build` – production build.
- `npm run start` – serve the production build.

## Troubleshooting
- **401 / 403** – ensure `GEMINI_API_KEY` is valid and permitted for the Gemini API.
- **Unsupported format** – uploads must be .png, .jpg, .jpeg, or .webp.
- **Empty response** – Gemini occasionally returns only text notes; adjust the prompt or remove references and retry.
- **History not updating** – check the console; failed requests keep the previous state and trigger an error toast.
- **Math solve parsing error** – Gemini must return JSON; clear the transcription, retry, or simplify the problem statement.

## Roadmap Ideas
- Mask editing: accept alpha maps or semantic masks for targeted edits.
- Persistent history storage (local or remote) so sessions survive refreshes.
- Prompt templates and reusable prompt fragments.
- Download bundles / shareable URLs for multi-image sets.
- Equation rendering (MathJax/KaTeX) for the math walkthrough.

## License
Add your preferred license here (for example MIT). The project currently ships without a formal license file.

---
If you produce something wild with Super Octo Doodle, drop a screenshot in an issue or discussion. Enjoy the iterative ride.