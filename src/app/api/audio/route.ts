import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Multiple Piped instances as fallback — avoids YouTube blocking Vercel IPs
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.projectsegfault.net",
  "https://pipedapi.in.projectsegfault.net",
];

async function getAudioUrl(
  videoId: string
): Promise<{ url: string; mimeType: string } | null> {
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
        bitrate?: number;
      }> = data.audioStreams ?? [];

      if (!streams.length) continue;

      // Prefer M4A (AAC) for iOS Safari — falls back to whatever is available
      const preferred =
        streams.find((s) => s.format === "M4A") ||
        streams.find((s) => s.mimeType?.includes("mp4")) ||
        streams[0];

      if (preferred?.url) {
        return {
          url: preferred.url,
          mimeType: preferred.mimeType?.split(";")[0] ?? "audio/mp4",
        };
      }
    } catch {
      // try next instance
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("id");
  if (!videoId) {
    return new NextResponse("Missing video ID", { status: 400 });
  }

  try {
    const audio = await getAudioUrl(videoId);
    if (!audio) {
      return new NextResponse("No audio found", { status: 404 });
    }

    const rangeHeader = request.headers.get("range");
    const fetchHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    const upstream = await fetch(audio.url, { headers: fetchHeaders });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", audio.mimeType);
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=3600");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    return new NextResponse(upstream.body, {
      status: rangeHeader ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Audio proxy error:", error);
    return new NextResponse("Failed to stream audio", { status: 500 });
  }
}
