import { NextRequest, NextResponse } from "next/server";
import { Innertube, UniversalCache } from "youtubei.js";

let innertube: Innertube | null = null;

async function getInnerTube() {
  if (!innertube) {
    innertube = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    });
  }
  return innertube;
}

interface RawFormat {
  itag: number;
  mimeType: string;
  url?: string;
  bitrate?: number;
  contentLength?: string;
  audioQuality?: string;
}

interface RawPlayerResponse {
  streamingData?: {
    adaptiveFormats?: RawFormat[];
  };
  videoDetails?: {
    title?: string;
    author?: string;
    lengthSeconds?: string;
    thumbnail?: {
      thumbnails?: Array<{ url: string; width: number; height: number }>;
    };
  };
  playabilityStatus?: {
    status?: string;
    reason?: string;
  };
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("id");
  if (!videoId) {
    return NextResponse.json({ error: "Missing video ID" }, { status: 400 });
  }

  try {
    const yt = await getInnerTube();

    // Use ANDROID client — gives direct URLs without signature cipher
    const response = await yt.actions.execute("/player", {
      videoId,
      client: "ANDROID",
    });

    const data = response.data as RawPlayerResponse;

    if (data?.playabilityStatus?.status !== "OK") {
      return NextResponse.json(
        { error: data?.playabilityStatus?.reason || "Video not available" },
        { status: 404 }
      );
    }

    const adaptiveFormats = data?.streamingData?.adaptiveFormats || [];

    // Filter audio-only, must have URL
    const audioFormats = adaptiveFormats
      .filter((f) => f.mimeType?.startsWith("audio/") && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Prefer audio/mp4 for browser compatibility
    const m4aFormat = audioFormats.find((f) => f.mimeType?.includes("audio/mp4"));
    const bestFormat = m4aFormat || audioFormats[0];

    if (!bestFormat?.url) {
      return NextResponse.json(
        { error: "No audio stream available" },
        { status: 404 }
      );
    }

    const thumbnails = data?.videoDetails?.thumbnail?.thumbnails || [];
    const bestThumb = thumbnails[thumbnails.length - 1]?.url || "";

    return NextResponse.json({
      url: bestFormat.url,
      title: data?.videoDetails?.title || "",
      artist: (data?.videoDetails?.author || "").replace(/ - Topic$/, ""),
      thumbnail: bestThumb,
      duration: parseInt(data?.videoDetails?.lengthSeconds || "0", 10),
      mimeType: bestFormat.mimeType || "audio/mp4",
    });
  } catch (error) {
    console.error("Stream error:", error);
    innertube = null;
    return NextResponse.json(
      { error: "Failed to get stream" },
      { status: 500 }
    );
  }
}
