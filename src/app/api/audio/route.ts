import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("id");
  if (!videoId) {
    return new NextResponse("Missing video ID", { status: 400 });
  }

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // Get video info and pick best audio-only format
    const info = await ytdl.getInfo(url);
    const formats = ytdl.filterFormats(info.formats, "audioonly");

    if (formats.length === 0) {
      return new NextResponse("No audio format found", { status: 404 });
    }

    // Prefer m4a/mp4 for iOS compatibility, then webm/opus
    const preferred =
      formats.find(
        (f) => f.container === "mp4" || f.mimeType?.includes("mp4")
      ) || formats[0];

    if (!preferred.url) {
      return new NextResponse("No audio URL available", { status: 404 });
    }

    const mimeType = preferred.mimeType?.split(";")[0] || "audio/mp4";
    const totalSize = preferred.contentLength
      ? parseInt(preferred.contentLength, 10)
      : null;

    // Proxy the audio stream from YouTube's CDN
    const rangeHeader = request.headers.get("range");
    const fetchHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.youtube.com/",
      Origin: "https://www.youtube.com",
    };

    if (rangeHeader) {
      // Browser is seeking — forward the Range header as-is
      fetchHeaders["Range"] = rangeHeader;

      const upstream = await fetch(preferred.url, { headers: fetchHeaders });

      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", mimeType);
      responseHeaders.set("Accept-Ranges", "bytes");
      responseHeaders.set("Cache-Control", "public, max-age=3600");

      const contentLength = upstream.headers.get("content-length");
      if (contentLength) responseHeaders.set("Content-Length", contentLength);
      const contentRange = upstream.headers.get("content-range");
      if (contentRange) responseHeaders.set("Content-Range", contentRange);

      return new NextResponse(upstream.body, {
        status: 206,
        headers: responseHeaders,
      });
    }

    // Initial request (no Range header) — return full 200 response.
    // iOS Safari needs a proper 200 with Content-Length on the first request
    // to validate the audio source before it starts making Range requests.
    const upstream = await fetch(preferred.url, { headers: fetchHeaders });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", mimeType);
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=3600");

    // Use the known content length from ytdl format info, or fall back to upstream header
    const contentLength =
      totalSize?.toString() || upstream.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    return new NextResponse(upstream.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Audio proxy error:", error);
    return new NextResponse("Failed to stream audio", { status: 500 });
  }
}
