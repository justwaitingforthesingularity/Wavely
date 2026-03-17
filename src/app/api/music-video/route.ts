import { NextRequest, NextResponse } from "next/server";
import { Innertube } from "youtubei.js";

let innertube: Innertube | null = null;

async function getInnerTube() {
  if (!innertube) {
    innertube = await Innertube.create({
      lang: "en",
      location: "US",
      retrieve_player: false,
    });
  }
  return innertube;
}

function toText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (obj.toString && typeof obj.toString === "function") {
      const str = obj.toString();
      if (str !== "[object Object]") return str;
    }
  }
  return "";
}

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  const artist = request.nextUrl.searchParams.get("artist");

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  try {
    const yt = await getInnerTube();
    const query = `${title} ${artist || ""}`.trim();
    const results = await yt.music.search(query, { type: "video" });
    const items =
      (results.contents?.[0] as { contents?: unknown[] })?.contents || [];

    if (items.length === 0) {
      return NextResponse.json({ found: false, videos: [] });
    }

    // Return up to 10 video results for alternative selection
    const videos: { videoId: string; title: string; artist: string; thumbnail: string }[] = [];
    for (let i = 0; i < Math.min(items.length, 10); i++) {
      const video = items[i] as Record<string, unknown>;
      const videoId = toText(video.id);
      if (!videoId) continue;

      let thumb = "";
      const thumbnails = video.thumbnails || video.thumbnail;
      if (Array.isArray(thumbnails) && thumbnails.length > 0) {
        thumb = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || "";
      } else if (thumbnails && typeof thumbnails === "object") {
        const thumbArr = (thumbnails as { contents?: { url?: string }[] }).contents;
        if (Array.isArray(thumbArr) && thumbArr.length > 0) {
          thumb = thumbArr[thumbArr.length - 1]?.url || thumbArr[0]?.url || "";
        }
      }

      // Get artist from authors/artists array
      let videoArtist = "";
      const authors = video.authors || video.artists;
      if (Array.isArray(authors) && authors.length > 0) {
        videoArtist = toText((authors[0] as Record<string, unknown>)?.name) || toText(authors[0]);
      }

      videos.push({
        videoId,
        title: toText(video.title),
        artist: videoArtist,
        thumbnail: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    }

    if (videos.length === 0) {
      return NextResponse.json({ found: false, videos: [] });
    }

    return NextResponse.json({
      found: true,
      videoId: videos[0].videoId,
      title: videos[0].title,
      videos,
    });
  } catch (error) {
    console.error("Music video search error:", error);
    innertube = null;
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
