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

const OFFICIAL_AUTHORS = [
  "youtube music",
  "youtube",
  "google",
  "spotify",
  "apple music",
  "vevo",
  "tidal",
  "deezer",
  "amazon music",
];

function isOfficialPlaylist(author: string): boolean {
  const lower = author.toLowerCase().trim();
  return OFFICIAL_AUTHORS.some((o) => lower.includes(o));
}

export async function GET(request: NextRequest) {
  const genre = request.nextUrl.searchParams.get("genre");

  if (!genre) {
    return NextResponse.json(
      { error: "Missing 'genre' query parameter" },
      { status: 400 }
    );
  }

  try {
    const yt = await getInnerTube();

    // Run 3 searches in parallel
    const [playlistResults, artistResults, trendingResults] = await Promise.all([
      yt.music.search(`${genre} music playlist`, { type: "playlist" }).catch(() => null),
      yt.music.search(`${genre} artists`, { type: "artist" }).catch(() => null),
      yt.music.search(`${genre} new music 2026`, { type: "song" }).catch(() => null),
    ]);

    // Parse playlists and split into official vs community
    const plItems =
      (playlistResults?.contents?.[0] as { contents?: unknown[] } | undefined)?.contents || [];
    const allPlaylists = plItems.slice(0, 20).map((item: unknown) => {
      const pl = item as Record<string, unknown>;
      const plThumb = extractThumb(pl.thumbnail);
      let author = toText(pl.author);
      if (!author) {
        const authors = pl.authors as { name?: unknown }[] | undefined;
        author = authors?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";
      }
      return {
        id: toText(pl.id) || toText(pl.browse_id),
        title: toText(pl.title) || "Unknown Playlist",
        author,
        thumbnail: plThumb,
        songCount: toText(pl.total_items) || toText(pl.item_count) || toText(pl.subtitle) || "",
      };
    }).filter((p) => p.id);

    const official = allPlaylists.filter((p) => isOfficialPlaylist(p.author));
    const community = allPlaylists.filter((p) => !isOfficialPlaylist(p.author));

    // Parse artists
    const artItems =
      (artistResults?.contents?.[0] as { contents?: unknown[] } | undefined)?.contents || [];
    const artists = artItems.slice(0, 10).map((item: unknown) => {
      const artist = item as Record<string, unknown>;
      const bestThumb = extractThumb(artist.thumbnail);
      return {
        id: toText(artist.id),
        name: toText(artist.name) || "Unknown Artist",
        thumbnail: bestThumb,
        subscribers: toText(artist.subscribers),
      };
    });

    // Parse trending songs
    const trendItems =
      (trendingResults?.contents?.[0] as { contents?: unknown[] } | undefined)?.contents || [];
    const trending = trendItems.slice(0, 20).map((item: unknown) => {
      const song = item as {
        id?: string;
        title?: string;
        artists?: { name?: unknown; channel_id?: string }[];
        album?: { name?: unknown };
        thumbnail?: { contents?: { url?: string }[] };
        duration?: { seconds?: number; text?: unknown };
      };
      const thumbnails = song.thumbnail?.contents || [];
      const bestThumb = thumbnails[thumbnails.length - 1]?.url || "";
      const artistIds = (song.artists || [])
        .filter((a) => a.channel_id)
        .map((a) => ({ id: a.channel_id!, name: toText(a.name) }));

      return {
        id: song.id || "",
        title: toText(song.title) || "Unknown",
        artist: song.artists?.map((a) => toText(a.name)).join(", ") || "Unknown Artist",
        artistIds,
        album: toText(song.album?.name),
        thumbnail: bestThumb,
        duration: song.duration?.seconds || 0,
        durationText: toText(song.duration?.text),
      };
    });

    return NextResponse.json({
      playlists: { official, community },
      artists,
      trending,
    });
  } catch (error) {
    console.error("Genre API error:", error);
    innertube = null;
    return NextResponse.json(
      { playlists: { official: [], community: [] }, artists: [], trending: [], error: "Genre search failed" },
      { status: 500 }
    );
  }
}
