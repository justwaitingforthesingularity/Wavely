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

function extractThumb(thumbData: unknown): string {
  if (!thumbData) return "";
  if (typeof thumbData === "string") return thumbData;
  const obj = thumbData as Record<string, unknown>;
  if (Array.isArray(obj.contents)) {
    const items = obj.contents as { url?: string }[];
    return items[items.length - 1]?.url || "";
  }
  if (Array.isArray(thumbData)) {
    const items = thumbData as { url?: string }[];
    return items[items.length - 1]?.url || "";
  }
  if (typeof obj.url === "string") return obj.url;
  return "";
}

export async function GET(request: NextRequest) {
  const playlistId = request.nextUrl.searchParams.get("id");

  if (!playlistId) {
    return NextResponse.json({ error: "Missing playlist ID" }, { status: 400 });
  }

  try {
    const yt = await getInnerTube();
    const playlist = await yt.music.getPlaylist(playlistId);

    const header = playlist.header as unknown as Record<string, unknown>;

    const playlistInfo = {
      id: playlistId,
      title: toText(header?.title) || "Unknown Playlist",
      author: toText(header?.subtitle) || toText(header?.author) || "",
      thumbnail: extractThumb(header?.thumbnail),
      description: toText(header?.description) || "",
    };

    const items = playlist.items || [];
    const songs = (items as unknown[]).slice(0, 50).map((item: unknown) => {
      const song = item as Record<string, unknown>;
      const songThumb = extractThumb(song.thumbnail);

      // Try multiple fields for artist extraction
      let artists = song.artists as { name?: unknown; channel_id?: string }[] | undefined;
      let artistName = artists?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";

      // Fallback: try authors field
      if (!artistName) {
        const authors = song.authors as { name?: unknown; channel_id?: string }[] | undefined;
        if (authors && authors.length > 0) {
          artists = authors;
          artistName = authors.map((a) => toText(a.name)).filter(Boolean).join(", ");
        }
      }

      // Fallback: try flex_columns or subtitle for artist info
      if (!artistName) {
        const subtitle = toText(song.subtitle);
        if (subtitle) artistName = subtitle;
      }

      // Fallback: try author field directly
      if (!artistName) {
        artistName = toText(song.author);
      }

      const artistIds = (artists || [])
        .filter((a) => a.channel_id)
        .map((a) => ({ id: a.channel_id!, name: toText(a.name) }));
      const dur = song.duration as { seconds?: number } | undefined;

      return {
        id: toText(song.id),
        title: toText(song.title) || "Unknown",
        artist: artistName,
        artistIds,
        thumbnail: songThumb,
        duration: dur?.seconds || 0,
      };
    }).filter((s) => s.id);

    return NextResponse.json({ playlist: playlistInfo, songs });
  } catch (error) {
    console.error("Playlist fetch error:", error);
    innertube = null;
    return NextResponse.json({ error: "Failed to fetch playlist" }, { status: 500 });
  }
}
