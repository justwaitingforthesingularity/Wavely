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

    // Run 2 searches in parallel (artists are extracted from song results)
    const [playlistResults, trendingResults] = await Promise.all([
      yt.music.search(`${genre} music playlist`, { type: "playlist" }).catch(() => null),
      yt.music.search(`top ${genre} hits`, { type: "song" }).catch(() => null),
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

    // Parse trending songs
    const trendItems =
      (trendingResults?.contents?.[0] as { contents?: unknown[] } | undefined)?.contents || [];
    const trending = trendItems.slice(0, 20).map((item: unknown) => {
      const song = item as {
        id?: string;
        title?: string;
        artists?: { name?: unknown; channel_id?: string; thumbnails?: { url?: string }[] }[];
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

    // Extract unique artists from trending songs (real genre artists, not channels named after genres)
    const seenArtistIds = new Set<string>();
    const artistsFromSongs: { id: string; name: string }[] = [];
    for (const song of trending) {
      for (const ref of song.artistIds) {
        if (ref.id && ref.name && !seenArtistIds.has(ref.id)) {
          seenArtistIds.add(ref.id);
          artistsFromSongs.push({ id: ref.id, name: ref.name });
        }
      }
    }

    // Fetch artist thumbnails in parallel (up to 10 artists)
    const artistsToFetch = artistsFromSongs.slice(0, 10);
    const artists = await Promise.all(
      artistsToFetch.map(async (a) => {
        try {
          const result = await yt.music.search(a.name, { type: "artist" });
          const items = (result?.contents?.[0] as { contents?: unknown[] } | undefined)?.contents || [];
          // Find the exact match by channel ID or first result
          for (const item of items) {
            const artist = item as Record<string, unknown>;
            const id = toText(artist.id);
            if (id === a.id || items.indexOf(item) === 0) {
              return {
                id: a.id,
                name: a.name,
                thumbnail: extractThumb(artist.thumbnail),
                subscribers: toText(artist.subscribers),
              };
            }
          }
          return { id: a.id, name: a.name, thumbnail: "", subscribers: "" };
        } catch {
          return { id: a.id, name: a.name, thumbnail: "", subscribers: "" };
        }
      })
    );

    return NextResponse.json({
      playlists: { official, community },
      artists: artists.filter((a) => a.thumbnail),
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
