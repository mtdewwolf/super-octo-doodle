# Super Octo Doodle - Gemini Thumbnail Lab

Super Octo Doodle is a Next.js playground for rapid thumbnail iteration on top of Google's Gemini image API. Upload any base image, optionally layer in reference shots for style transfer, describe the edit you want, and watch Gemini hand back versioned thumbnails that you can iterate on instantly.

## Highlights
- Guided upload workflow with live preview and glassmorphism UI.
- Multi-image support: attach up to three reference assets for style transfer or composition.
- Automatic hand-off: the first Gemini variant becomes the new editable base image.
- Download and share controls for every generated frame and timeline entry.
- History strip with tap-to-reuse thumbnails and quick download/share badges.
- Toast notifications for status updates instead of intrusive banners.
- CLI helper script for local experimentation without the UI.

## System Architecture
`
Browser (React form)
    +- multipart POST (base image + references + instructions)
Next.js API route (/api/upload)
    +- GoogleGenAI.generateContent(model="gemini-2.5-flash-image-preview")
    +- inline images + Gemini notes returned to the client
Browser state updates (preview, history, reference list, toasts)
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
3. Configure environment variables by creating .env.local in the project root:
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
1. **Choose Base Image** - upload a PNG, JPG, or WEBP. The preview and history timeline update immediately.
2. **Add Reference Images (optional)** - supply up to three style/subject shots to steer Gemini toward composites or transfer effects.
3. **Describe the edit** - e.g. make the horse pink with a cosmic background, keep the rider sharp.
4. **Submit** - the UI triggers Gemini and surfaces progress via toasts.
5. **Review & iterate** - download or share any render, promote variants via history taps, tweak the prompt, and submit again.

## Multi-Image & Style Transfer
- Each reference image is bundled into the multipart request and becomes an additional inlineData part for Gemini.
- The UI enforces a maximum of three reference files, shows mini previews, and lets you remove individual items before submitting.
- Combine subject and background assets for mashups, or drop a style frame to nudge the final render.

## Download & Share
- Every generated image exposes **Download** (saves to disk) and **Share Link** (Web Share API with clipboard fallback) buttons.
- History thumbnails include compact DL and Share shortcuts so you can grab or send any previous frame without promoting it.

## CLI Helper
For quick experiments outside the UI, use the Node script:
`ash
node --env-file=.env.local scripts/gemini-generate-image.mjs "Create a cyberpunk nano banana billboard"
`
- Reads GEMINI_API_KEY, GEMINI_IMAGE_MODEL, and optional GEMINI_SEED_IMAGE_PATH.
- Writes base64 responses to the outputs/ directory.
- Pass a prompt via CLI arguments or set GEMINI_PROMPT in your shell.

## Response Shape
/api/upload responds with:
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
Errors and content-policy warnings bubble up in the message field and HTTP status.

## Styling Notes
- Tailwind CSS (v4) drives layout utilities.
- Glassmorphism: translucent layers with backdrop blur and gradient lighting.
- Toasts and history scrollbar styling live in src/app/page.tsx and src/app/globals.css.

## Development Scripts
- 
pm run dev - Next.js dev server with hot reload (Turbopack).
- 
pm run build - production build.
- 
pm run start - serve the production build.

## Troubleshooting
- **401 / 403** - ensure GEMINI_API_KEY is valid and permitted for the Gemini API.
- **Unsupported format** - uploads must be .png, .jpg, .jpeg, or .webp.
- **Empty response** - Gemini occasionally returns only text notes; adjust the prompt or remove references and retry.
- **History not updating** - check the console; failed requests keep the previous state and trigger an error toast.

## Roadmap Ideas
- Mask editing: accept alpha maps or semantic masks for targeted edits.
- Persistent history storage (local or remote) so sessions survive refreshes.
- Prompt templates and reusable prompt fragments.
- Download bundles / shareable URLs for multi-image sets.

## License
Add your preferred license here (for example MIT). The project currently ships without a formal license file.

---
If you produce something wild with Super Octo Doodle, drop a screenshot in an issue or discussion. Enjoy the iterative ride.

