import { NextRequest, NextResponse } from "next/server";
import { Innertube } from "youtubei.js";
import { getHQThumbnail } from "@/utils/thumbnail";

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
  if (typeof thumbData === "string") return getHQThumbnail(thumbData);
  const obj = thumbData as Record<string, unknown>;
  if (Array.isArray(obj.contents)) {
    const items = obj.contents as { url?: string }[];
    return getHQThumbnail(items[items.length - 1]?.url || "");
  }
  if (Array.isArray(thumbData)) {
    const items = thumbData as { url?: string }[];
    return getHQThumbnail(items[items.length - 1]?.url || "");
  }
  if (typeof obj.url === "string") return getHQThumbnail(obj.url);
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

// Curated real verified artists per genre — these are the biggest names
const GENRE_ARTISTS: Record<string, string[]> = {
  "Pop": ["Taylor Swift", "Ariana Grande", "Billie Eilish", "Dua Lipa", "Ed Sheeran", "Olivia Rodrigo", "Harry Styles", "Doja Cat", "Sabrina Carpenter", "Bruno Mars"],
  "Hip-Hop": ["Drake", "Kendrick Lamar", "Travis Scott", "J. Cole", "21 Savage", "Future", "Metro Boomin", "Lil Baby", "Kanye West", "Tyler The Creator"],
  "Rock": ["Foo Fighters", "Imagine Dragons", "Arctic Monkeys", "Linkin Park", "Green Day", "Red Hot Chili Peppers", "Muse", "The Killers", "Nirvana", "Radiohead"],
  "R&B": ["The Weeknd", "SZA", "Daniel Caesar", "Frank Ocean", "Summer Walker", "Brent Faiyaz", "Usher", "Bryson Tiller", "H.E.R.", "Chris Brown"],
  "Electronic": ["Calvin Harris", "Marshmello", "Martin Garrix", "Kygo", "Skrillex", "Deadmau5", "Zedd", "David Guetta", "Avicii", "Tiësto"],
  "Jazz": ["Norah Jones", "Robert Glasper", "Kamasi Washington", "Gregory Porter", "Diana Krall", "Miles Davis", "John Coltrane", "Esperanza Spalding", "Chet Baker", "Herbie Hancock"],
  "Classical": ["Ludovico Einaudi", "Yo-Yo Ma", "Lang Lang", "Max Richter", "Hans Zimmer", "Yiruma", "André Rieu", "Ólafur Arnalds", "Chopin", "Debussy"],
  "Lo-Fi": ["Nujabes", "Jinsang", "Tomppabeats", "Idealism", "Kupla", "Philanthrope", "Mondo Loops", "Saib", "Swørn", "Aso"],
};

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

    // Get curated artist names for this genre
    const curatedArtists = GENRE_ARTISTS[genre] || [];

    // Run playlist search + trending songs search in parallel
    const [playlistResults, trendingResults] = await Promise.all([
      yt.music.search(`${genre} music playlist`, { type: "playlist" }).catch(() => null),
      yt.music.search(`${genre} hits 2025 2026`, { type: "song" }).catch(() => null),
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
        artists?: { name?: unknown; channel_id?: string }[];
        album?: { name?: unknown };
        thumbnail?: { contents?: { url?: string }[] };
        duration?: { seconds?: number; text?: unknown };
      };
      const thumbnails = song.thumbnail?.contents || [];
      const bestThumb = getHQThumbnail(thumbnails[thumbnails.length - 1]?.url || "");
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

    // Fetch curated artist thumbnails in parallel (real verified artists only)
    const artists = (await Promise.all(
      curatedArtists.map(async (name) => {
        try {
          const result = await yt.music.search(name, { type: "artist" });
          const items = (result?.contents?.[0] as { contents?: unknown[] } | undefined)?.contents || [];
          if (items.length > 0) {
            const artist = items[0] as Record<string, unknown>;
            return {
              id: toText(artist.id),
              name,
              thumbnail: extractThumb(artist.thumbnail),
              subscribers: toText(artist.subscribers),
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    )).filter((a): a is NonNullable<typeof a> => a !== null && !!a.thumbnail);

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
