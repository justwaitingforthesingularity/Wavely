import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  const artist = request.nextUrl.searchParams.get("artist");
  const duration = request.nextUrl.searchParams.get("duration");

  if (!title || !artist) {
    return NextResponse.json({ error: "Missing title or artist" }, { status: 400 });
  }

  try {
    // Try LRCLIB API for synced lyrics
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    if (duration) {
      params.set("duration", duration);
    }

    // First try the get endpoint for exact match
    const getUrl = `https://lrclib.net/api/get?${params.toString()}`;
    let response = await fetch(getUrl, {
      headers: { "User-Agent": "Wavely Music App v1.0" },
    });

    let data = null;
    if (response.ok) {
      data = await response.json();
    }

    // If no exact match, try search
    if (!data || (!data.syncedLyrics && !data.plainLyrics)) {
      const searchUrl = `https://lrclib.net/api/search?${params.toString()}`;
      response = await fetch(searchUrl, {
        headers: { "User-Agent": "Wavely Music App v1.0" },
      });

      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          // Pick the first result that has synced lyrics, or fallback to plain
          data = results.find((r: { syncedLyrics?: string }) => r.syncedLyrics) || results[0];
        }
      }
    }

    if (!data) {
      return NextResponse.json({ found: false, syncedLyrics: null, plainLyrics: null });
    }

    return NextResponse.json({
      found: true,
      syncedLyrics: data.syncedLyrics || null,
      plainLyrics: data.plainLyrics || null,
    });
  } catch (error) {
    console.error("Lyrics fetch error:", error);
    return NextResponse.json({ found: false, syncedLyrics: null, plainLyrics: null });
  }
}
