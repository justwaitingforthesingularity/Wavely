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
  const albumId = request.nextUrl.searchParams.get("id");

  if (!albumId) {
    return NextResponse.json({ error: "Missing album ID" }, { status: 400 });
  }

  try {
    const yt = await getInnerTube();
    const album = await yt.music.getAlbum(albumId);

    const header = album.header as unknown as Record<string, unknown>;

    // Extract artist info from header
    let albumArtist = toText(header?.subtitle);
    if (!albumArtist) {
      albumArtist = toText(header?.strapline_text_one);
    }
    if (!albumArtist) {
      const artists = header?.artists as { name?: unknown }[] | undefined;
      albumArtist = artists?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";
    }
    if (!albumArtist) {
      albumArtist = toText(header?.author);
    }

    // Extract year
    let year = toText(header?.year);
    if (!year) {
      const menu = toText(header?.menu);
      if (menu) year = menu;
    }

    const albumInfo = {
      id: albumId,
      title: toText(header?.title) || "Unknown Album",
      artist: albumArtist,
      thumbnail: extractThumb(header?.thumbnail),
      year,
      description: toText(header?.description) || "",
    };

    // Extract tracks - try multiple locations
    let trackItems: unknown[] = [];

    // Try album.contents (array of sections or direct items)
    if (album.contents) {
      const contents = album.contents as unknown;
      if (Array.isArray(contents)) {
        // Could be an array of sections or direct track items
        for (const item of contents) {
          const sec = item as Record<string, unknown>;
          if (sec.contents && Array.isArray(sec.contents)) {
            // It's a section with contents
            trackItems = [...trackItems, ...(sec.contents as unknown[])];
          } else if (sec.id || sec.title) {
            // It's a direct track item
            trackItems.push(item);
          }
        }
      } else if (typeof contents === "object" && contents !== null) {
        const obj = contents as Record<string, unknown>;
        if (Array.isArray(obj.contents)) {
          trackItems = obj.contents as unknown[];
        }
      }
    }

    // Fallback: try album.sections
    if (trackItems.length === 0 && (album as unknown as Record<string, unknown>).sections) {
      const sections = (album as unknown as Record<string, unknown>).sections as unknown[];
      for (const section of sections) {
        const sec = section as Record<string, unknown>;
        if (sec.contents && Array.isArray(sec.contents)) {
          trackItems = [...trackItems, ...(sec.contents as unknown[])];
        }
      }
    }

    const songs = trackItems.slice(0, 50).map((item: unknown) => {
      const song = item as Record<string, unknown>;
      const songThumb = extractThumb(song.thumbnail) || albumInfo.thumbnail;

      // Try multiple fields for artist extraction
      let artists = song.artists as { name?: unknown; channel_id?: string }[] | undefined;
      let artistName = artists?.map((a) => toText(a.name)).filter(Boolean).join(", ") || "";

      if (!artistName) {
        const authors = song.authors as { name?: unknown; channel_id?: string }[] | undefined;
        if (authors && authors.length > 0) {
          artists = authors;
          artistName = authors.map((a) => toText(a.name)).filter(Boolean).join(", ");
        }
      }

      if (!artistName) {
        artistName = toText(song.subtitle) || toText(song.author) || albumArtist;
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

    return NextResponse.json({ album: albumInfo, songs });
  } catch (error) {
    console.error("Album fetch error:", error);
    innertube = null;
    return NextResponse.json({ error: "Failed to fetch album" }, { status: 500 });
  }
}
