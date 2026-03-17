import { NextRequest, NextResponse } from "next/server";
import { Innertube, UniversalCache } from "youtubei.js";

export const maxDuration = 30;

/* ── Piped (primary) ─────────────────────────────────────────────── */

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.projectsegfault.net",
  "https://pipedapi.in.projectsegfault.net",
];

async function getAudioUrlFromPiped(videoId: string): Promise<string | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const streams: Array<{
        url: string;
        mimeType?: string;
        format?: string;
      }> = data.audioStreams ?? [];
      if (!streams.length) continue;

      // iOS Safari CANNOT play Opus/WebM — only pick M4A (AAC) streams
      const m4a =
        streams.find((s) => s.format === "M4A") ||
        streams.find((s) => s.mimeType?.startsWith("audio/mp4"));

      if (m4a?.url) return m4a.url;
    } catch {
      // try next instance
    }
  }
  return null;
}

/* ── Innertube (fallback) ─────────────────────────────────────────── */

let innertube: Innertube | null = null;

async function getAudioUrlFromInnertube(
  videoId: string
): Promise<string | null> {
  try {
    if (!innertube) {
      innertube = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
    }

    const response = await innertube.actions.execute("/player", {
      videoId,
      client: "ANDROID",
    });

    const data = response.data as {
      streamingData?: {
        adaptiveFormats?: Array<{
          mimeType: string;
          url?: string;
          bitrate?: number;
        }>;
      };
      playabilityStatus?: { status?: string };
    };

    if (data?.playabilityStatus?.status !== "OK") return null;

    const formats = (data?.streamingData?.adaptiveFormats || [])
      .filter((f) => f.mimeType?.startsWith("audio/mp4") && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    return formats[0]?.url || null;
  } catch {
    innertube = null;
    return null;
  }
}

/* ── Route handler ─────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("id");
  if (!videoId) {
    return new NextResponse("Missing video ID", { status: 400 });
  }

  try {
    // Try Piped first, then Innertube as fallback
    let audioUrl = await getAudioUrlFromPiped(videoId);
    if (!audioUrl) {
      console.log("Piped failed, trying Innertube for:", videoId);
      audioUrl = await getAudioUrlFromInnertube(videoId);
    }

    if (!audioUrl) {
      return new NextResponse("No audio found", { status: 404 });
    }

    // Redirect browser directly to the audio URL.
    // This avoids streaming through Vercel (timeout + iOS issues).
    // The browser handles range requests and seeking natively with the CDN.
    return NextResponse.redirect(audioUrl, 302);
  } catch (error) {
    console.error("Audio error:", error);
    return new NextResponse("Failed to get audio", { status: 500 });
  }
}
