"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { Song } from "@/types/song";
import { Artist } from "@/types/artist";
import { Playlist } from "@/types/playlist";

interface LibraryState {
  likedSongs: Song[];
  history: Song[];
  playlists: Playlist[];
  followedArtists: Artist[];
}

interface LibraryActions {
  toggleLike: (song: Song) => void;
  isLiked: (songId: string) => boolean;
  addToHistory: (song: Song) => void;
  createPlaylist: (name: string) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addToPlaylist: (playlistId: string, song: Song) => void;
  removeFromPlaylist: (playlistId: string, songId: string) => void;
  toggleFollow: (artist: Artist) => void;
  isFollowing: (artistId: string) => boolean;
  loadFromCloud: (data: { likedSongs: Song[]; playlists: Playlist[]; followedArtists: Artist[]; history: Song[] }) => void;
}

const LibraryContext = createContext<(LibraryState & LibraryActions) | null>(null);

const STORAGE_KEYS = {
  liked: "wavely_liked_songs",
  history: "wavely_history",
  playlists: "wavely_playlists",
  followedArtists: "wavely_followed_artists",
};

const MAX_HISTORY = 50;

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable
  }
}

// Helper to sync actions to the server (fire-and-forget)
function syncToServer(type: string, action: string, data: Record<string, unknown>) {
  const token = typeof window !== "undefined" ? localStorage.getItem("wavely_auth_token") : null;
  if (!token) return;
  fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type, action, data }),
  }).catch(() => {});
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LibraryState>({
    likedSongs: [],
    history: [],
    playlists: [],
    followedArtists: [],
  });
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setState({
      likedSongs: loadFromStorage(STORAGE_KEYS.liked, []),
      history: loadFromStorage(STORAGE_KEYS.history, []),
      playlists: loadFromStorage(STORAGE_KEYS.playlists, []),
      followedArtists: loadFromStorage(STORAGE_KEYS.followedArtists, []),
    });
    setLoaded(true);
  }, []);

  // Persist changes
  useEffect(() => {
    if (!loaded) return;
    saveToStorage(STORAGE_KEYS.liked, state.likedSongs);
  }, [state.likedSongs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveToStorage(STORAGE_KEYS.history, state.history);
  }, [state.history, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveToStorage(STORAGE_KEYS.playlists, state.playlists);
  }, [state.playlists, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveToStorage(STORAGE_KEYS.followedArtists, state.followedArtists);
  }, [state.followedArtists, loaded]);

  const toggleLike = useCallback((song: Song) => {
    setState((prev) => {
      const exists = prev.likedSongs.some((s) => s.id === song.id);
      // Sync to server
      syncToServer("liked_song", exists ? "remove" : "add", song as unknown as Record<string, unknown>);
      return {
        ...prev,
        likedSongs: exists
          ? prev.likedSongs.filter((s) => s.id !== song.id)
          : [song, ...prev.likedSongs],
      };
    });
  }, []);

  const isLiked = useCallback(
    (songId: string) => state.likedSongs.some((s) => s.id === songId),
    [state.likedSongs]
  );

  const addToHistory = useCallback((song: Song) => {
    syncToServer("history", "add", song as unknown as Record<string, unknown>);
    setState((prev) => {
      const filtered = prev.history.filter((s) => s.id !== song.id);
      return {
        ...prev,
        history: [song, ...filtered].slice(0, MAX_HISTORY),
      };
    });
  }, []);

  const createPlaylist = useCallback((name: string): Playlist => {
    const playlist: Playlist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // If logged in, create on server and use server ID
    const token = typeof window !== "undefined" ? localStorage.getItem("wavely_auth_token") : null;
    if (token) {
      fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "playlist", action: "create", data: { name } }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.playlist) {
            // Replace local ID with server ID
            setState((prev) => ({
              ...prev,
              playlists: prev.playlists.map((p) =>
                p.id === playlist.id
                  ? { ...p, id: data.playlist.id }
                  : p
              ),
            }));
          }
        })
        .catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      playlists: [...prev.playlists, playlist],
    }));
    return playlist;
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    syncToServer("playlist", "delete", { id });
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.filter((p) => p.id !== id),
    }));
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    syncToServer("playlist", "rename", { id, name });
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p
      ),
    }));
  }, []);

  const addToPlaylist = useCallback((playlistId: string, song: Song) => {
    syncToServer("playlist", "add_song", { playlistId, song: song as unknown as Record<string, unknown> });
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((p) =>
        p.id === playlistId && !p.songs.some((s) => s.id === song.id)
          ? { ...p, songs: [...p.songs, song], updatedAt: Date.now() }
          : p
      ),
    }));
  }, []);

  const removeFromPlaylist = useCallback((playlistId: string, songId: string) => {
    syncToServer("playlist", "remove_song", { playlistId, songId });
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((p) =>
        p.id === playlistId
          ? { ...p, songs: p.songs.filter((s) => s.id !== songId), updatedAt: Date.now() }
          : p
      ),
    }));
  }, []);

  const toggleFollow = useCallback((artist: Artist) => {
    setState((prev) => {
      const exists = prev.followedArtists.some((a) => a.id === artist.id);
      syncToServer("followed_artist", exists ? "remove" : "add", artist as unknown as Record<string, unknown>);
      return {
        ...prev,
        followedArtists: exists
          ? prev.followedArtists.filter((a) => a.id !== artist.id)
          : [artist, ...prev.followedArtists],
      };
    });
  }, []);

  const isFollowing = useCallback(
    (artistId: string) => state.followedArtists.some((a) => a.id === artistId),
    [state.followedArtists]
  );

  // Load data from cloud (replaces local data)
  const loadFromCloud = useCallback((data: { likedSongs: Song[]; playlists: Playlist[]; followedArtists: Artist[]; history: Song[] }) => {
    setState({
      likedSongs: data.likedSongs || [],
      playlists: data.playlists || [],
      followedArtists: data.followedArtists || [],
      history: data.history || [],
    });
  }, []);

  return (
    <LibraryContext.Provider
      value={{
        ...state,
        toggleLike,
        isLiked,
        addToHistory,
        createPlaylist,
        deletePlaylist,
        renamePlaylist,
        addToPlaylist,
        removeFromPlaylist,
        toggleFollow,
        isFollowing,
        loadFromCloud,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used within LibraryProvider");
  }
  return context;
}
