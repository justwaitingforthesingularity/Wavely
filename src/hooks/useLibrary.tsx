"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
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
    setState((prev) => ({
      ...prev,
      playlists: [...prev.playlists, playlist],
    }));
    return playlist;
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.filter((p) => p.id !== id),
    }));
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p
      ),
    }));
  }, []);

  const addToPlaylist = useCallback((playlistId: string, song: Song) => {
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
