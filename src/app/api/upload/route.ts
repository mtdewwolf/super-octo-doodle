import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const formData = await request.formData();
    const instructionsEntry = formData.get("instructions");
    const thumbnailEntry = formData.get("thumbnail");

    const instructions =
        typeof instructionsEntry === "string" ? instructionsEntry : "";

    if (!(thumbnailEntry instanceof File)) {
        console.warn("Upload attempt without a thumbnail file.");
        return NextResponse.json(
            { ok: false, message: "Thumbnail file is required." },
            { status: 400 }
        );
    }

    console.log("Received instructions:", instructions);
    console.log("Thumbnail size (bytes):", thumbnailEntry.size);

    return NextResponse.json({ ok: true });
}
