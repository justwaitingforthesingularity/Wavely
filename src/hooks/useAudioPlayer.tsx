"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { Song } from "@/types/song";

type RepeatMode = "off" | "all" | "one";

interface AudioPlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Song[];
  queueIndex: number;
  isLoading: boolean;
  isPlayerOpen: boolean;
  dominantColor: string;
  shuffle: boolean;
  repeat: RepeatMode;
}

interface VideoControls {
  toggle: () => void;
  isPlaying: () => boolean;
}

interface AudioPlayerActions {
  playSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  openPlayer: () => void;
  closePlayer: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  registerVideoControls: (controls: VideoControls) => void;
  unregisterVideoControls: () => void;
  setIsPlaying: (playing: boolean) => void;
}

const AudioPlayerContext = createContext<(AudioPlayerState & AudioPlayerActions) | null>(null);

export function AudioPlayerProvider({ children, onSongPlay, onAudioElement }: { children: React.ReactNode; onSongPlay?: (song: Song) => void; onAudioElement?: (el: HTMLAudioElement) => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoControlsRef = useRef<VideoControls | null>(null);
  const onSongPlayRef = useRef(onSongPlay);
  onSongPlayRef.current = onSongPlay;
  const onAudioElementRef = useRef(onAudioElement);
  onAudioElementRef.current = onAudioElement;
  const [state, setState] = useState<AudioPlayerState>({
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    queue: [],
    queueIndex: -1,
    isLoading: false,
    isPlayerOpen: false,
    dominantColor: "30, 215, 96",
    shuffle: false,
    repeat: "off",
  });

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = state.volume;

      // Notify parent (for EQ connection)
      onAudioElementRef.current?.(audioRef.current);

      audioRef.current.addEventListener("timeupdate", () => {
        setState((prev) => ({
          ...prev,
          currentTime: audioRef.current?.currentTime || 0,
        }));
      });

      audioRef.current.addEventListener("loadedmetadata", () => {
        setState((prev) => ({
          ...prev,
          duration: audioRef.current?.duration || 0,
          isLoading: false,
        }));
      });

      audioRef.current.addEventListener("ended", () => {
        setState((prev) => {
          // Repeat one: replay current song
          if (prev.repeat === "one" && prev.currentSong) {
            loadAndPlay(prev.currentSong, prev.queue, prev.queueIndex);
            return prev;
          }

          // Shuffle: pick a random different song from queue
          if (prev.shuffle && prev.queue.length > 1) {
            let nextIndex: number;
            do {
              nextIndex = Math.floor(Math.random() * prev.queue.length);
            } while (nextIndex === prev.queueIndex);
            const nextSong = prev.queue[nextIndex];
            loadAndPlay(nextSong, prev.queue, nextIndex);
            return { ...prev, queueIndex: nextIndex, currentSong: nextSong };
          }

          // Normal: play next in queue
          if (prev.queueIndex < prev.queue.length - 1) {
            const nextIndex = prev.queueIndex + 1;
            const nextSong = prev.queue[nextIndex];
            loadAndPlay(nextSong, prev.queue, nextIndex);
            return { ...prev, queueIndex: nextIndex, currentSong: nextSong };
          }

          // End of queue with repeat all: go back to start
          if (prev.repeat === "all" && prev.queue.length > 0) {
            const nextSong = prev.queue[0];
            loadAndPlay(nextSong, prev.queue, 0);
            return { ...prev, queueIndex: 0, currentSong: nextSong };
          }

          return { ...prev, isPlaying: false };
        });
      });

      audioRef.current.addEventListener("playing", () => {
        setState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
      });

      audioRef.current.addEventListener("pause", () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
      });

      audioRef.current.addEventListener("waiting", () => {
        setState((prev) => ({ ...prev, isLoading: true }));
      });

      audioRef.current.addEventListener("error", () => {
        const err = audioRef.current?.error;
        console.error("Audio element error:", err?.code, err?.message);
        setState((prev) => ({ ...prev, isLoading: false, isPlaying: false }));
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update CSS variable for dynamic background
  useEffect(() => {
    document.documentElement.style.setProperty("--dynamic-color", state.dominantColor);
  }, [state.dominantColor]);

  // Extract a dominant color from thumbnail
  const extractColor = useCallback((thumbnail: string) => {
    if (typeof window === "undefined") return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        // Boost saturation slightly for dark backgrounds
        const boosted = [
          Math.min(255, r + 30),
          Math.min(255, g + 30),
          Math.min(255, b + 30),
        ];
        setState((prev) => ({
          ...prev,
          dominantColor: `${boosted[0]}, ${boosted[1]}, ${boosted[2]}`,
        }));
      } catch {
        // CORS or canvas error — use default color
      }
    };
    img.src = thumbnail;
  }, []);

  const loadAndPlay = useCallback(
    async (song: Song, queue?: Song[], index?: number) => {
      if (!audioRef.current) return;

      // Detect video-only songs: when song.id === song.musicVideoId,
      // the YouTube embed handles playback — skip loading audio.
      const isVideoOnly = !!(song.musicVideoId && song.id === song.musicVideoId);
      const skipAudio = isVideoOnly;

      setState((prev) => ({
        ...prev,
        isLoading: !skipAudio,
        currentSong: song,
        queue: queue || prev.queue,
        queueIndex: index ?? prev.queueIndex,
      }));

      // Track in history
      onSongPlayRef.current?.(song);

      const title = song.title;
      const artist = song.artist;
      const thumbnail = song.thumbnail;

      // Extract color from album art
      extractColor(thumbnail);

      // Set Media Session metadata (lock screen / notification controls)
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          artwork: [
            { src: thumbnail, sizes: "512x512", type: "image/jpeg" },
          ],
        });
        navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
        navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
        navigator.mediaSession.setActionHandler("previoustrack", () => prevTrack());
        navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack());
      }

      // For video-only songs on desktop, don't load audio — the YT embed handles it
      if (skipAudio) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        // Use our audio proxy endpoint
        const proxyUrl = `/api/audio?id=${encodeURIComponent(song.id)}`;
        audioRef.current.src = proxyUrl;
        // Call play() immediately to preserve the user gesture context on iOS.
        // The browser will buffer and start playing when data arrives.
        // The existing "error" event listener on the audio element handles failures.
        await audioRef.current.play();
      } catch (error) {
        console.error("Failed to play:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extractColor]
  );

  const playSong = useCallback(
    (song: Song, queue?: Song[]) => {
      const songQueue = queue || [song];
      const index = songQueue.findIndex((s) => s.id === song.id);
      loadAndPlay(song, songQueue, index >= 0 ? index : 0);
    },
    [loadAndPlay]
  );

  const togglePlay = useCallback(() => {
    // For video-only songs, delegate to the YT player
    if (videoControlsRef.current) {
      videoControlsRef.current.toggle();
      return;
    }
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    setState((prev) => ({ ...prev, volume }));
  }, []);

  const nextTrack = useCallback(() => {
    setState((prev) => {
      if (prev.shuffle && prev.queue.length > 1) {
        let nextIndex: number;
        do {
          nextIndex = Math.floor(Math.random() * prev.queue.length);
        } while (nextIndex === prev.queueIndex);
        const nextSong = prev.queue[nextIndex];
        loadAndPlay(nextSong, prev.queue, nextIndex);
        return prev;
      }
      if (prev.queueIndex < prev.queue.length - 1) {
        const nextIndex = prev.queueIndex + 1;
        const nextSong = prev.queue[nextIndex];
        loadAndPlay(nextSong, prev.queue, nextIndex);
        return prev;
      }
      if (prev.repeat === "all" && prev.queue.length > 0) {
        const nextSong = prev.queue[0];
        loadAndPlay(nextSong, prev.queue, 0);
        return prev;
      }
      return prev;
    });
  }, [loadAndPlay]);

  const prevTrack = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    setState((prev) => {
      if (prev.queueIndex > 0) {
        const prevIndex = prev.queueIndex - 1;
        const prevSong = prev.queue[prevIndex];
        loadAndPlay(prevSong, prev.queue, prevIndex);
        return prev;
      }
      return prev;
    });
  }, [loadAndPlay]);

  const toggleShuffle = useCallback(() => {
    setState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setState((prev) => ({
      ...prev,
      repeat: prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
    }));
  }, []);

  const openPlayer = useCallback(() => {
    setState((prev) => ({ ...prev, isPlayerOpen: true }));
  }, []);

  const closePlayer = useCallback(() => {
    setState((prev) => ({ ...prev, isPlayerOpen: false }));
  }, []);

  const registerVideoControls = useCallback((controls: VideoControls) => {
    videoControlsRef.current = controls;
  }, []);

  const unregisterVideoControls = useCallback(() => {
    videoControlsRef.current = null;
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setState((prev) => ({ ...prev, isPlaying: playing }));
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        ...state,
        playSong,
        togglePlay,
        pause,
        seek,
        setVolume,
        nextTrack,
        prevTrack,
        openPlayer,
        closePlayer,
        toggleShuffle,
        toggleRepeat,
        registerVideoControls,
        unregisterVideoControls,
        setIsPlaying,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return context;
}
