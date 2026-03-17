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

// Safely extract text from YouTube's rich text objects
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

// Extract best thumbnail URL from various YouTube thumbnail formats
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
  const query = request.nextUrl.searchParams.get("q");
  const type = request.nextUrl.searchParams.get("type") || "song";

  if (!query) {
    return NextResponse.json({ items: [], artists: [], playlists: [] });
  }

  try {
    const yt = await getInnerTube();

    if (type === "artist") {
      const results = await yt.music.search(query, { type: "artist" });
      const items = (results.contents?.[0] as { contents?: unknown[] })?.contents || [];

      const artists = items.slice(0, 10).map((item: unknown) => {
        const artist = item as Record<string, unknown>;
        const bestThumb = extractThumb(artist.thumbnail);
        return {
          id: toText(artist.id),
          name: toText(artist.name) || "Unknown Artist",
          thumbnail: bestThumb,
          subscribers: toText(artist.subscribers),
        };
      });

      return NextResponse.json({ artists });
    }

    // Default: search for songs
    const results = await yt.music.search(query, { type: "song" });
    const items = (results.contents?.[0] as { contents?: unknown[] })?.contents || [];

    const songs = items.slice(0, 20).map((item: unknown) => {
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

    // Artist search (top results)
    let topArtists: { id: string; name: string; thumbnail: string; subscribers: string }[] = [];
    try {
      const artistResults = await yt.music.search(query, { type: "artist" });
      const artistItems = (artistResults.contents?.[0] as { contents?: unknown[] })?.contents || [];
      topArtists = artistItems.slice(0, 3).map((item: unknown) => {
        const artist = item as Record<string, unknown>;
        const bestThumb = extractThumb(artist.thumbnail);
        return {
          id: toText(artist.id),
          name: toText(artist.name) || "Unknown Artist",
          thumbnail: bestThumb,
          subscribers: toText(artist.subscribers),
        };
      });
    } catch {
      // Artist search failed
    }

    // Album search
    let albumResults: { id: string; title: string; artist: string; thumbnail: string; year: string; type: string }[] = [];
    try {
      const albResults = await yt.music.search(query, { type: "album" });
      const albItems = (albResults.contents?.[0] as { contents?: unknown[] })?.contents || [];
      albumResults = albItems.slice(0, 6).map((item: unknown) => {
        const alb = item as Record<string, unknown>;
        const albThumb = extractThumb(alb.thumbnail);

        let albumArtist = toText(alb.author);
        if (!albumArtist) {
          const authors = alb.authors as { name?: unknown }[] | undefined;
          albumArtist = authors?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";
        }
        if (!albumArtist) {
          const artists = alb.artists as { name?: unknown }[] | undefined;
          albumArtist = artists?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";
        }

        return {
          id: toText(alb.id) || toText(alb.browse_id),
          title: toText(alb.title) || "Unknown Album",
          artist: albumArtist,
          thumbnail: albThumb,
          year: toText(alb.year) || "",
          type: toText(alb.type) || "Album",
        };
      }).filter((a) => a.id);
    } catch {
      // Album search failed
    }

    // Playlist search
    let playlistResults: { id: string; title: string; author: string; thumbnail: string; songCount: string }[] = [];
    try {
      const plResults = await yt.music.search(query, { type: "playlist" });
      const plItems = (plResults.contents?.[0] as { contents?: unknown[] })?.contents || [];
      playlistResults = plItems.slice(0, 6).map((item: unknown) => {
        const pl = item as Record<string, unknown>;
        const plThumb = extractThumb(pl.thumbnail);

        // Author can be in various fields
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
    } catch {
      // Playlist search failed
    }

    // Video search
    let videoResults: { id: string; title: string; artist: string; thumbnail: string; duration: number; views: string; songId: string }[] = [];
    try {
      const vidResults = await yt.music.search(query, { type: "video" });
      const vidItems = (vidResults.contents?.[0] as { contents?: unknown[] })?.contents || [];
      videoResults = vidItems.slice(0, 6).map((item: unknown) => {
        const vid = item as Record<string, unknown>;
        const vidThumb = extractThumb(vid.thumbnail);

        let vidArtist = toText(vid.author);
        if (!vidArtist) {
          const artists = vid.artists as { name?: unknown }[] | undefined;
          vidArtist = artists?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";
        }
        if (!vidArtist) {
          const authors = vid.authors as { name?: unknown }[] | undefined;
          vidArtist = authors?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";
        }

        const dur = vid.duration as { seconds?: number } | undefined;
        const videoId = toText(vid.id);

        // Try to find matching song ID from the song results
        const matchingSong = songs.find(
          (s) => s.title.toLowerCase() === (toText(vid.title) || "").toLowerCase()
        );

        return {
          id: videoId,
          title: toText(vid.title) || "Unknown",
          artist: vidArtist,
          thumbnail: vidThumb,
          duration: dur?.seconds || 0,
          views: toText(vid.views) || toText(vid.subtitle) || "",
          songId: matchingSong?.id || videoId,
        };
      }).filter((v) => v.id);
    } catch {
      // Video search failed
    }

    return NextResponse.json({ items: songs, artists: topArtists, albums: albumResults, playlists: playlistResults, videos: videoResults });
  } catch (error) {
    console.error("Search error:", error);
    innertube = null;
    return NextResponse.json({ items: [], artists: [], playlists: [], videos: [], error: "Search failed" }, { status: 500 });
  }
}
