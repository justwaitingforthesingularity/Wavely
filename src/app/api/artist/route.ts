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

  // Format 1: { contents: [{ url }] }
  if (Array.isArray(obj.contents)) {
    const items = obj.contents as { url?: string }[];
    return items[items.length - 1]?.url || "";
  }

  // Format 2: [{ url }] (direct array)
  if (Array.isArray(thumbData)) {
    const items = thumbData as { url?: string }[];
    return items[items.length - 1]?.url || "";
  }

  // Format 3: { url } (direct object)
  if (typeof obj.url === "string") return obj.url;

  return "";
}

export async function GET(request: NextRequest) {
  const artistId = request.nextUrl.searchParams.get("id");

  if (!artistId) {
    return NextResponse.json({ error: "Missing artist ID" }, { status: 400 });
  }

  try {
    const yt = await getInnerTube();
    const artist = await yt.music.getArtist(artistId);

    // Extract artist info
    const header = artist.header as unknown as Record<string, unknown>;

    const bestThumb = extractThumb(header?.thumbnail);

    const artistInfo = {
      id: artistId,
      name: toText(header?.title) || "Unknown Artist",
      thumbnail: bestThumb,
      subscribers: toText(header?.subtitle) || toText(header?.strapline_text_one) || "",
      description: toText(header?.description) || "",
    };

    // Extract sections
    const sections = artist.sections || [];
    let topSongs: {
      id: string;
      title: string;
      artist: string;
      thumbnail: string;
      duration: number;
    }[] = [];

    let albums: {
      id: string;
      title: string;
      year: string;
      thumbnail: string;
      type: string;
    }[] = [];

    let videos: {
      id: string;
      title: string;
      artist: string;
      thumbnail: string;
      duration: number;
    }[] = [];

    let relatedArtists: {
      id: string;
      name: string;
      thumbnail: string;
      subscribers: string;
    }[] = [];

    for (const section of sections) {
      const sec = section as unknown as {
        type?: string;
        header?: Record<string, unknown>;
        contents?: unknown[];
      };

      const sectionTitle = toText(sec.header?.title).toLowerCase();

      // Top songs / Songs section
      if (sectionTitle.includes("song") || sectionTitle.includes("top")) {
        const contents = sec.contents || [];
        topSongs = contents.slice(0, 20).map((item: unknown) => {
          const song = item as Record<string, unknown>;
          const songThumb = extractThumb(song.thumbnail);
          const artists = song.artists as { name?: unknown }[] | undefined;
          const artistName = artists
            ?.map((a) => toText(a.name))
            .filter(Boolean)
            .join(", ") || artistInfo.name;
          const dur = song.duration as { seconds?: number } | undefined;

          return {
            id: toText(song.id),
            title: toText(song.title) || "Unknown",
            artist: artistName,
            thumbnail: songThumb || bestThumb,
            duration: dur?.seconds || 0,
          };
        }).filter((s) => s.id);
      }

      // Albums / Singles section
      if (sectionTitle.includes("album") || sectionTitle.includes("single") || sectionTitle.includes("release")) {
        const contents = sec.contents || [];
        const newAlbums = contents.slice(0, 20).map((item: unknown) => {
          const album = item as Record<string, unknown>;
          const albumThumb = extractThumb(album.thumbnail);

          // Year can be in subtitle, year, or nested
          const subtitle = toText(album.subtitle);
          const year = toText(album.year) || subtitle || "";

          return {
            id: toText(album.id) || toText((album as Record<string, unknown>).browse_id),
            title: toText(album.title) || "Unknown Album",
            year,
            thumbnail: albumThumb || bestThumb,
            type: sectionTitle.includes("single") ? "Single" : "Album",
          };
        }).filter((a) => a.id || a.title !== "Unknown Album");
        albums = [...albums, ...newAlbums];
      }

      // Music Videos section
      if (sectionTitle.includes("video")) {
        const contents = sec.contents || [];
        const newVideos = contents.slice(0, 10).map((item: unknown) => {
          const vid = item as Record<string, unknown>;
          const vidThumb = extractThumb(vid.thumbnail);
          const artists = vid.artists as { name?: unknown }[] | undefined;
          let artistName = artists?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";
          if (!artistName) {
            const authors = vid.authors as { name?: unknown }[] | undefined;
            artistName = authors?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";
          }
          if (!artistName) {
            artistName = toText(vid.author) || artistInfo.name;
          }
          const dur = vid.duration as { seconds?: number } | undefined;

          return {
            id: toText(vid.id),
            title: toText(vid.title) || "Unknown",
            artist: artistName,
            thumbnail: vidThumb || bestThumb,
            duration: dur?.seconds || 0,
          };
        }).filter((v) => v.id);
        videos = [...videos, ...newVideos];
      }

      // Related / Fans also like section
      if (sectionTitle.includes("fan") || sectionTitle.includes("related") || sectionTitle.includes("similar")) {
        const contents = sec.contents || [];
        relatedArtists = contents.slice(0, 10).map((item: unknown) => {
          const ra = item as Record<string, unknown>;

          // Try multiple thumbnail extraction approaches
          let raThumb = extractThumb(ra.thumbnail);
          if (!raThumb) {
            raThumb = extractThumb(ra.thumbnails);
          }

          return {
            id: toText(ra.id) || toText(ra.browse_id),
            name: toText(ra.name) || toText(ra.title) || "Unknown Artist",
            thumbnail: raThumb,
            subscribers: toText(ra.subscribers) || toText(ra.subtitle) || "",
          };
        }).filter((a) => a.id);
      }
    }

    // If no top songs found from sections, try searching
    if (topSongs.length === 0) {
      try {
        const searchResults = await yt.music.search(artistInfo.name, { type: "song" });
        const searchItems = (searchResults.contents?.[0] as { contents?: unknown[] })?.contents || [];
        topSongs = searchItems.slice(0, 15).map((item: unknown) => {
          const song = item as Record<string, unknown>;
          const songThumb = extractThumb(song.thumbnail);
          const artists = song.artists as { name?: unknown }[] | undefined;
          const artistName = artists?.map((a) => toText(a.name)).filter(Boolean).join(", ") || artistInfo.name;
          const dur = song.duration as { seconds?: number } | undefined;
          return {
            id: toText(song.id),
            title: toText(song.title) || "Unknown",
            artist: artistName,
            thumbnail: songThumb,
            duration: dur?.seconds || 0,
          };
        }).filter((s) => s.id);
      } catch {
        // Fallback search failed
      }
    }

    return NextResponse.json({
      artist: artistInfo,
      topSongs,
      albums,
      videos,
      relatedArtists,
    });
  } catch (error) {
    console.error("Artist fetch error:", error);
    innertube = null;
    return NextResponse.json({ error: "Failed to fetch artist" }, { status: 500 });
  }
}
