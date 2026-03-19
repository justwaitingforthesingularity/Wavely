import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Helper to validate session
async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const { data: session } = await supabase
    .from("wavely_sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) return null;
  return session.user_id as string;
}

// GET - Pull all user data from server
export async function GET(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch all user data in parallel
    const [likedRes, playlistsRes, followedRes, historyRes, settingsRes] = await Promise.all([
      supabase
        .from("wavely_liked_songs")
        .select("song_id, title, artist, thumbnail, duration, artist_refs, liked_at")
        .eq("user_id", userId)
        .order("liked_at", { ascending: false }),
      supabase
        .from("wavely_playlists")
        .select("id, name, created_at, updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("wavely_followed_artists")
        .select("artist_id, name, thumbnail, subscribers, followed_at")
        .eq("user_id", userId)
        .order("followed_at", { ascending: false }),
      supabase
        .from("wavely_history")
        .select("song_id, title, artist, thumbnail, duration, artist_refs, played_at")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(50),
      supabase
        .from("wavely_user_settings")
        .select("settings")
        .eq("user_id", userId)
        .single(),
    ]);

    // Fetch songs for each playlist
    const playlists = playlistsRes.data || [];
    const playlistsWithSongs = await Promise.all(
      playlists.map(async (pl) => {
        const { data: songs } = await supabase
          .from("wavely_playlist_songs")
          .select("song_id, title, artist, thumbnail, duration, artist_refs, position")
          .eq("playlist_id", pl.id)
          .order("position", { ascending: true });

        return {
          id: pl.id,
          name: pl.name,
          createdAt: new Date(pl.created_at).getTime(),
          updatedAt: new Date(pl.updated_at).getTime(),
          songs: (songs || []).map((s) => ({
            id: s.song_id,
            title: s.title,
            artist: s.artist,
            thumbnail: s.thumbnail,
            duration: s.duration,
            artistRefs: s.artist_refs || [],
          })),
        };
      })
    );

    return NextResponse.json({
      likedSongs: (likedRes.data || []).map((s) => ({
        id: s.song_id,
        title: s.title,
        artist: s.artist,
        thumbnail: s.thumbnail,
        duration: s.duration,
        artistRefs: s.artist_refs || [],
      })),
      playlists: playlistsWithSongs,
      followedArtists: (followedRes.data || []).map((a) => ({
        id: a.artist_id,
        name: a.name,
        thumbnail: a.thumbnail,
        subscribers: a.subscribers,
      })),
      history: (historyRes.data || []).map((s) => ({
        id: s.song_id,
        title: s.title,
        artist: s.artist,
        thumbnail: s.thumbnail,
        duration: s.duration,
        artistRefs: s.artist_refs || [],
      })),
      settings: settingsRes.data?.settings || {},
    });
  } catch (err) {
    console.error("Sync pull error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Push user data to server
export async function POST(req: NextRequest) {
  try {
    const userId = await getUser(req);
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { type, action, data } = await req.json();

    switch (type) {
      case "liked_song": {
        if (action === "add") {
          await supabase.from("wavely_liked_songs").upsert({
            user_id: userId,
            song_id: data.id,
            title: data.title,
            artist: data.artist,
            thumbnail: data.thumbnail || "",
            duration: data.duration || 0,
            artist_refs: data.artistRefs || [],
          }, { onConflict: "user_id,song_id" });
        } else if (action === "remove") {
          await supabase
            .from("wavely_liked_songs")
            .delete()
            .eq("user_id", userId)
            .eq("song_id", data.id);
        }
        break;
      }

      case "playlist": {
        if (action === "create") {
          const { data: pl } = await supabase
            .from("wavely_playlists")
            .insert({ user_id: userId, name: data.name })
            .select("id, name, created_at, updated_at")
            .single();
          if (pl) {
            return NextResponse.json({
              success: true,
              playlist: {
                id: pl.id,
                name: pl.name,
                createdAt: new Date(pl.created_at).getTime(),
                updatedAt: new Date(pl.updated_at).getTime(),
                songs: [],
              },
            });
          }
        } else if (action === "delete") {
          await supabase.from("wavely_playlists").delete().eq("id", data.id).eq("user_id", userId);
        } else if (action === "rename") {
          await supabase
            .from("wavely_playlists")
            .update({ name: data.name, updated_at: new Date().toISOString() })
            .eq("id", data.id)
            .eq("user_id", userId);
        } else if (action === "add_song") {
          // Get current max position
          const { data: maxPos } = await supabase
            .from("wavely_playlist_songs")
            .select("position")
            .eq("playlist_id", data.playlistId)
            .order("position", { ascending: false })
            .limit(1)
            .single();

          await supabase.from("wavely_playlist_songs").upsert({
            playlist_id: data.playlistId,
            song_id: data.song.id,
            title: data.song.title,
            artist: data.song.artist,
            thumbnail: data.song.thumbnail || "",
            duration: data.song.duration || 0,
            artist_refs: data.song.artistRefs || [],
            position: (maxPos?.position ?? -1) + 1,
          }, { onConflict: "playlist_id,song_id" });

          await supabase
            .from("wavely_playlists")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", data.playlistId);
        } else if (action === "remove_song") {
          await supabase
            .from("wavely_playlist_songs")
            .delete()
            .eq("playlist_id", data.playlistId)
            .eq("song_id", data.songId);
        }
        break;
      }

      case "followed_artist": {
        if (action === "add") {
          await supabase.from("wavely_followed_artists").upsert({
            user_id: userId,
            artist_id: data.id,
            name: data.name,
            thumbnail: data.thumbnail || "",
            subscribers: data.subscribers || "",
          }, { onConflict: "user_id,artist_id" });
        } else if (action === "remove") {
          await supabase
            .from("wavely_followed_artists")
            .delete()
            .eq("user_id", userId)
            .eq("artist_id", data.id);
        }
        break;
      }

      case "history": {
        if (action === "add") {
          await supabase.from("wavely_history").insert({
            user_id: userId,
            song_id: data.id,
            title: data.title,
            artist: data.artist,
            thumbnail: data.thumbnail || "",
            duration: data.duration || 0,
            artist_refs: data.artistRefs || [],
          });
          // Keep only latest 50
          const { data: old } = await supabase
            .from("wavely_history")
            .select("id")
            .eq("user_id", userId)
            .order("played_at", { ascending: false })
            .range(50, 1000);
          if (old && old.length > 0) {
            await supabase
              .from("wavely_history")
              .delete()
              .in("id", old.map((r) => r.id));
          }
        }
        break;
      }

      case "settings": {
        await supabase.from("wavely_user_settings").upsert({
          user_id: userId,
          settings: data,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown sync type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Sync push error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
