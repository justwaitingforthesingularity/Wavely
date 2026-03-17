"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useLibrary } from "@/hooks/useLibrary";
import { useEqualizer } from "@/hooks/useEqualizer";
import { useLyrics } from "@/hooks/useLyrics";
import { formatTime } from "@/services/audioPlayer";
import EQPanel from "./EQPanel";
import LyricsPanel from "./LyricsPanel";

function getHQThumbnail(url: string): string {
  if (!url) return url;
  if (url.includes("lh3.googleusercontent.com") || url.includes("googleusercontent.com")) {
    return url
      .replace(/=w\d+-h\d+[^&?]*/g, "=w1200-h1200-l90-rj")
      .replace(/=s\d+[^&?]*/g, "=s1200");
  }
  if (url.includes("i.ytimg.com")) {
    return url.replace(/(hq|mq|sd|default)default/, "maxresdefault");
  }
  return url;
}

// YouTube IFrame API loader
function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.YT?.Player) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const check = setInterval(() => {
      if (win.YT?.Player) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}

type ViewMode = "song" | "video";

interface VideoOption {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
}

// Offset slider component
function OffsetSlider({ offset, setOffset }: { offset: number; setOffset: (v: number | ((o: number) => number)) => void }) {
  return (
    <div className="flex items-center gap-2 px-2">
      <span className="text-[10px] text-white/30 font-medium flex-shrink-0">-5s</span>
      <div className="flex-1 relative h-6 flex items-center">
        <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full bg-white/30 rounded-full transition-[width] duration-100"
            style={{ width: `${((offset + 5) / 10) * 100}%` }}
          />
        </div>
        <input
          type="range"
          min={-5}
          max={5}
          step={0.1}
          value={offset}
          onChange={(e) => setOffset(Math.round(Number(e.target.value) * 10) / 10)}
          className="absolute w-full opacity-0 h-6 cursor-pointer"
        />
      </div>
      <span className="text-[10px] text-white/30 font-medium flex-shrink-0">+5s</span>
      <span className="text-[10px] text-white/40 tabular-nums min-w-[38px] text-center font-medium flex-shrink-0">
        {offset === 0 ? "sync" : `${offset > 0 ? "+" : ""}${offset.toFixed(1)}s`}
      </span>
      {offset !== 0 && (
        <button
          onClick={() => setOffset(0)}
          className="text-[10px] text-white/30 hover:text-white/50 transition-colors flex-shrink-0"
        >
          reset
        </button>
      )}
    </div>
  );
}

// Inline lyrics scroller for video mode — active line at bottom
function InlineLyricsScroller({
  videoTime,
  songTitle,
  songArtist,
  duration,
  seek,
}: {
  videoTime: number;
  songTitle: string;
  songArtist: string;
  duration: number;
  seek: (t: number) => void;
}) {
  const [offset, setOffset] = useState(0);
  const currentTime = videoTime + offset;
  const { lyrics, plainLyrics, loading, error } = useLyrics(songTitle, songArtist, duration);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLButtonElement>(null);
  const lastScrolledLine = useRef(-1);

  useEffect(() => {
    lastScrolledLine.current = -1;
  }, [lyrics]);

  const activeLine = lyrics
    ? lyrics.reduce((acc, line, i) => (line.time <= currentTime ? i : acc), -1)
    : -1;

  // Scroll active line into view — use getBoundingClientRect for reliable positioning
  useEffect(() => {
    if (activeLine >= 0 && activeLine !== lastScrolledLine.current && activeLineRef.current && containerRef.current) {
      lastScrolledLine.current = activeLine;
      const container = containerRef.current;
      const element = activeLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      // Calculate element's position relative to the scroll container
      const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
      const containerHeight = container.clientHeight;
      // Position active line about 60% down so there's room above and below
      const targetScroll = relativeTop - containerHeight * 0.6;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, [activeLine]);

  return (
    <div className="flex flex-col flex-1 min-h-[120px]">
      {/* Offset slider */}
      {lyrics && (
        <div className="py-1.5 flex-shrink-0">
          <OffsetSlider offset={offset} setOffset={setOffset} />
        </div>
      )}

      {/* Scrollable lyrics area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto scrollbar-hide px-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="w-5 h-5 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
            <p className="text-[11px] text-white/30">Finding lyrics...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-1">
            <p className="text-[12px] text-white/30">No lyrics found</p>
          </div>
        )}

        {lyrics && !loading && (
          <div className="space-y-2.5 pt-2">
            {/* Top spacer so first lines can scroll up */}
            <div className="h-8" />
            {lyrics.map((line, i) => (
              <button
                key={i}
                ref={i === activeLine ? activeLineRef : null}
                onClick={() => seek(line.time)}
                className={`block w-full text-left transition-all duration-300 ${
                  i === activeLine
                    ? "text-white text-[15px] font-bold opacity-100"
                    : i < activeLine
                      ? "text-white/20 text-[13px] font-medium"
                      : "text-white/30 text-[13px] font-medium"
                }`}
              >
                {line.text}
              </button>
            ))}
            {/* Bottom spacer so last lines can scroll into view */}
            <div className="h-32" />
          </div>
        )}

        {plainLyrics && !lyrics && !loading && (
          <div className="py-4">
            {plainLyrics.split("\n").map((line, i) => (
              <p
                key={i}
                className={`text-[13px] leading-relaxed ${
                  line.trim() ? "text-white/50 font-medium" : "h-3"
                }`}
              >
                {line || "\u00A0"}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayerView() {
  const {
    currentSong,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    isPlayerOpen,
    dominantColor,
    shuffle,
    repeat,
    togglePlay,
    seek,
    nextTrack,
    prevTrack,
    closePlayer,
    toggleShuffle,
    toggleRepeat,
    pause,
    registerVideoControls,
    unregisterVideoControls,
    setIsPlaying,
    setCurrentTime,
    setDuration,
  } = useAudioPlayer();
  const router = useRouter();
  const { toggleLike, isLiked, playlists, addToPlaylist } = useLibrary();
  const { enabled: eqEnabled } = useEqualizer();
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showInlineLyrics, setShowInlineLyrics] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("song");

  // Video mode state
  const [musicVideoId, setMusicVideoId] = useState<string | null>(null);
  const [videoOptions, setVideoOptions] = useState<VideoOption[]>([]);
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const playerElIdRef = useRef(`yt-player-${Date.now()}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ytPlayerRef = useRef<any>(null);
  const videoTimeIntervalRef = useRef<number | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoOptionsCacheRef = useRef<Map<string, VideoOption[]>>(new Map());
  const wasPausedBeforeVideo = useRef(false);

  // Detect video-only songs
  const isVideoOnly = !!(currentSong?.musicVideoId && currentSong.id === currentSong.musicVideoId);

  // Reset view mode when song changes
  useEffect(() => {
    playerElIdRef.current = `yt-player-${Date.now()}`;
    setVideoError(false);
    setVideoPlaying(false);
    setVideoOptions([]);
    setVideoIndex(0);
    if (isVideoOnly) {
      setViewMode("video");
      setMusicVideoId(currentSong?.musicVideoId || null);
    } else {
      setViewMode("song");
      // Use song's YouTube ID — a hidden YT player provides audio
      setMusicVideoId(currentSong?.id || null);
    }
    setShowLyrics(false);
    setShowInlineLyrics(false);
    setVideoTime(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id, isVideoOnly, currentSong?.musicVideoId]);

  // For non-video-only songs that switch to video mode manually,
  // the audio was already paused by handleViewModeChange().
  // For video-only songs, loadAndPlay() skips audio entirely.
  // No reactive pause needed — it would fight with setIsPlaying from YT player.

  // Cleanup YT player
  const destroyPlayer = useCallback(() => {
    if (videoTimeIntervalRef.current) {
      clearInterval(videoTimeIntervalRef.current);
      videoTimeIntervalRef.current = null;
    }
    try {
      ytPlayerRef.current?.destroy?.();
    } catch {
      // Player may already be destroyed
    }
    ytPlayerRef.current = null;
  }, []);

  // Fetch music video options when switching to video mode
  useEffect(() => {
    if (viewMode !== "video" || !currentSong) return;
    setVideoError(false);

    // If the song already has a musicVideoId, use it as primary
    if (currentSong.musicVideoId) {
      setMusicVideoId(currentSong.musicVideoId);
    }

    // Check cache for alternatives
    const cacheKey = `${currentSong.title}|${currentSong.artist}`;
    const cached = videoOptionsCacheRef.current.get(cacheKey);
    if (cached) {
      setVideoOptions(cached);
      if (!currentSong.musicVideoId && cached.length > 0) {
        setMusicVideoId(cached[0].videoId);
      }
      return;
    }

    // Fetch video options from API
    if (!currentSong.musicVideoId) {
      setVideoLoading(true);
    }
    const params = new URLSearchParams({
      title: currentSong.title,
      artist: currentSong.artist,
    });

    fetch(`/api/music-video?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.videos && data.videos.length > 0) {
          videoOptionsCacheRef.current.set(cacheKey, data.videos);
          setVideoOptions(data.videos);
          if (!currentSong.musicVideoId) {
            setMusicVideoId(data.videos[0].videoId);
            setVideoIndex(0);
          } else {
            // Find current video in options, or prepend it
            const idx = data.videos.findIndex((v: VideoOption) => v.videoId === currentSong.musicVideoId);
            if (idx >= 0) {
              setVideoIndex(idx);
            } else {
              // Current video not in results, prepend it
              const allOptions = [
                { videoId: currentSong.musicVideoId, title: currentSong.title, artist: currentSong.artist, thumbnail: currentSong.thumbnail },
                ...data.videos,
              ];
              setVideoOptions(allOptions);
              setVideoIndex(0);
            }
          }
        } else if (!currentSong.musicVideoId) {
          setMusicVideoId(null);
        }
      })
      .catch(() => {
        if (!currentSong.musicVideoId) setMusicVideoId(null);
      })
      .finally(() => setVideoLoading(false));
  }, [viewMode, currentSong]);

  // Create YouTube player when musicVideoId is ready.
  // Used for ALL songs — hidden in song mode, visible in video mode.
  // NOT dependent on isPlayerOpen — the player view stays in the DOM (just off-screen)
  // so the iframe persists and audio keeps playing when minimized.
  useEffect(() => {
    if (!musicVideoId) return;

    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any = null;

    const startTimePolling = () => {
      if (videoTimeIntervalRef.current) {
        clearInterval(videoTimeIntervalRef.current);
      }
      videoTimeIntervalRef.current = window.setInterval(() => {
        try {
          const p = ytPlayerRef.current;
          if (p && typeof p.getCurrentTime === "function") {
            const t = p.getCurrentTime();
            if (typeof t === "number" && !isNaN(t)) {
              setVideoTime(t);
              setCurrentTime(t);
            }
            const d = p.getDuration();
            if (typeof d === "number" && !isNaN(d) && d > 0) {
              setDuration(d);
            }
          }
        } catch {
          // Player might be destroyed
        }
      }, 200);
    };

    const createPlayer = async () => {
      // Wait for React to commit the video container div to the DOM.
      if (!videoContainerRef.current) {
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 50));
          if (destroyed) return;
          if (videoContainerRef.current) break;
        }
        if (!videoContainerRef.current) {
          console.warn("Video container never appeared in DOM");
          return;
        }
      }

      await loadYouTubeAPI();
      if (destroyed) return;

      const elId = `yt-player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      playerElIdRef.current = elId;

      videoContainerRef.current.innerHTML = `<div id="${elId}" style="width:100%;height:100%"></div>`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;

      player = new win.YT.Player(elId, {
        videoId: musicVideoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (destroyed) return;
            startTimePolling();
            // Register video controls so MiniPlayer can toggle play/pause
            registerVideoControls({
              toggle: () => {
                try {
                  const p = ytPlayerRef.current;
                  if (!p) return;
                  const state = p.getPlayerState();
                  if (state === 1) {
                    p.pauseVideo();
                  } else {
                    p.playVideo();
                  }
                } catch {
                  // ignore
                }
              },
              isPlaying: () => {
                try {
                  return ytPlayerRef.current?.getPlayerState() === 1;
                } catch {
                  return false;
                }
              },
              seekTo: (time: number) => {
                try {
                  ytPlayerRef.current?.seekTo(time, true);
                } catch {
                  // ignore
                }
              },
              getDuration: () => {
                try {
                  return ytPlayerRef.current?.getDuration() || 0;
                } catch {
                  return 0;
                }
              },
            });
            try {
              player.playVideo();
            } catch {
              // ignore
            }
          },
          onStateChange: (event: { data: number }) => {
            if (destroyed) return;
            if (event.data === 1) {
              setVideoPlaying(true);
              setIsPlaying(true);
              if (!videoTimeIntervalRef.current) {
                startTimePolling();
              }
            } else if (event.data === 2) {
              setVideoPlaying(false);
              setIsPlaying(false);
            } else if (event.data === 0) {
              setVideoPlaying(false);
              setIsPlaying(false);
              nextTrack();
            }
          },
          onError: (event: { data: number }) => {
            if (destroyed) return;
            console.warn("YT Player error:", event.data, "for video:", musicVideoId);
            if (event.data === 100 || event.data === 101 || event.data === 150) {
              setVideoError(true);
            }
          },
        },
      });
      ytPlayerRef.current = player;
    };

    setVideoPlaying(false);
    setVideoError(false);
    createPlayer();

    return () => {
      destroyed = true;
      unregisterVideoControls();
      if (videoTimeIntervalRef.current) {
        clearInterval(videoTimeIntervalRef.current);
        videoTimeIntervalRef.current = null;
      }
      try {
        player?.destroy?.();
      } catch {
        // Already destroyed
      }
      ytPlayerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, musicVideoId, registerVideoControls, unregisterVideoControls, setIsPlaying, setCurrentTime, setDuration, nextTrack]);

  // Switch to a different video option
  const switchVideo = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= videoOptions.length) return;
    destroyPlayer();
    setVideoIndex(newIndex);
    setVideoError(false);
    setVideoPlaying(false);
    setVideoTime(0);
    setMusicVideoId(videoOptions[newIndex].videoId);
  }, [videoOptions, destroyPlayer]);

  // Handle video mode toggle
  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === viewMode) return;

    if (mode === "song" && currentSong) {
      // Revert to song's YouTube ID for audio
      setMusicVideoId(currentSong.id);
    }

    setViewMode(mode);
    setShowInlineLyrics(false);
  };

  const handleArtistClick = async () => {
    if (!currentSong) return;
    if (currentSong.artistRefs && currentSong.artistRefs.length > 0) {
      closePlayer();
      router.push(`/artist/${currentSong.artistRefs[0].id}`);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(currentSong.artist)}&type=artist`);
      const data = await res.json();
      if (data.artists && data.artists.length > 0) {
        closePlayer();
        router.push(`/artist/${data.artists[0].id}`);
      }
    } catch {
      // ignore
    }
  };

  const handleSourceClick = () => {
    if (!currentSong?.sourceContext) return;
    closePlayer();
    const ctx = currentSong.sourceContext;
    router.push(ctx.type === "album" ? `/album/${ctx.id}` : `/playlist/${ctx.id}`);
  };

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`fixed inset-0 z-[100] transition-transform duration-300 ease-out ${
        isPlayerOpen ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ touchAction: isPlayerOpen ? "none" : undefined, pointerEvents: isPlayerOpen ? "auto" : "none" }}
    >
      {/* Dynamic gradient background */}
      <div
        className="absolute inset-0 transition-colors duration-[2s]"
        style={{
          background: `linear-gradient(180deg,
            rgba(${dominantColor}, 0.45) 0%,
            rgba(${dominantColor}, 0.2) 30%,
            rgba(10, 10, 12, 0.95) 60%,
            rgb(10, 10, 12) 100%)`,
        }}
      />

      {/* Blurred album art background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentSong.thumbnail}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover blur-[80px] opacity-30 scale-150"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col px-8 pt-14 pb-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          {/* Left: close button */}
          <button
            onClick={closePlayer}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 active:bg-white/15 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 text-white/80">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Center: Song/Video toggle (or just "Video" label for video-only) */}
          {isVideoOnly ? (
            <span className="text-[11px] font-semibold tracking-wide text-white/60 px-4 py-1.5">
              Video
            </span>
          ) : (
            <div className="flex items-center bg-white/[0.07] rounded-full p-0.5">
              <button
                onClick={() => handleViewModeChange("song")}
                className={`px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-wide transition-all duration-200 ${
                  viewMode === "song"
                    ? "bg-white/[0.15] text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Song
              </button>
              <button
                onClick={() => handleViewModeChange("video")}
                className={`px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-wide transition-all duration-200 ${
                  viewMode === "video"
                    ? "bg-white/[0.15] text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Video
              </button>
            </div>
          )}

          {/* Right: action buttons */}
          <div className="flex items-center gap-1">
            {currentSong.sourceContext && (
              <button
                onClick={handleSourceClick}
                className="p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all"
                title={`Open ${currentSong.sourceContext.type === "album" ? "Album" : "Playlist"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px] text-white/50">
                  {currentSong.sourceContext.type === "album" ? (
                    <path fillRule="evenodd" d="m19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.403-4.909l2.311-.66a1.5 1.5 0 0 0 1.088-1.442V6.994l-9 2.572v9.737a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.402-4.909l2.31-.66a1.5 1.5 0 0 0 1.088-1.442V5.25a.75.75 0 0 1 .544-.721l10.5-3a.75.75 0 0 1 .658.122Z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0A.75.75 0 0 1 8.25 6h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75ZM2.625 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 12a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12A.75.75 0 0 1 7.5 12Zm-4.875 5.25a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
                  )}
                </svg>
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
                className="p-2 -mr-2 rounded-full hover:bg-white/10 active:scale-90 transition-all"
                title="Add to playlist"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px] text-white/50">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>

              {showPlaylistMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowPlaylistMenu(false)} />
                  <div className="absolute right-0 top-10 z-30 w-56 rounded-xl bg-[#282830] border border-white/[0.08] shadow-xl overflow-hidden animate-fadeIn">
                    {playlists.length > 0 ? (
                      <>
                        <p className="px-4 py-2 text-[11px] text-white/30 uppercase tracking-wider">Add to playlist</p>
                        {playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={() => {
                              addToPlaylist(pl.id, currentSong);
                              setShowPlaylistMenu(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-[13px] text-white/70 hover:bg-white/[0.06] transition-colors"
                          >
                            {pl.name}
                          </button>
                        ))}
                      </>
                    ) : (
                      <p className="px-4 py-3 text-[12px] text-white/30">
                        No playlists yet. Create one in Library.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Hidden YouTube player for audio in song mode */}
        {viewMode === "song" && (
          <div
            ref={videoContainerRef}
            className="fixed -top-[9999px] left-0 w-[320px] h-[180px] overflow-hidden pointer-events-none"
            style={{ opacity: 0.01 }}
            aria-hidden="true"
          />
        )}

        {/* ===== SONG MODE ===== */}
        {viewMode === "song" && (
          <>
            {/* Album artwork */}
            <div className="flex-1 flex items-center justify-center mb-8">
              <div className="relative w-full max-w-[320px] aspect-square animate-expandIn">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getHQThumbnail(currentSong.thumbnail)}
                  alt={currentSong.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-2xl"
                />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                    <div className="w-10 h-10 border-3 border-white/20 border-t-white/80 rounded-full animate-spin" />
                  </div>
                )}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-white/[0.08]" />
              </div>
            </div>

            {/* Song info */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1 min-w-0 mr-4">
                <h2 className="text-[22px] font-bold truncate leading-tight">
                  {currentSong.title}
                </h2>
                <p
                  onClick={handleArtistClick}
                  className="text-[15px] text-white/50 truncate mt-1 hover:text-white/70 hover:underline transition-colors cursor-pointer"
                >
                  {currentSong.artist}
                </p>
              </div>
              <button
                onClick={() => toggleLike(currentSong)}
                className="p-2 -mr-2 mt-1 rounded-full hover:bg-white/10 active:scale-90 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={liked ? 0 : 1.5} className={`w-6 h-6 ${liked ? "text-pink-400" : "text-white/50"}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
              </button>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="relative h-1 bg-white/[0.12] rounded-full overflow-hidden mb-2">
                <div
                  className="absolute left-0 top-0 h-full bg-white/80 rounded-full transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={duration || 1}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="absolute w-full opacity-0 h-6 -mt-4 cursor-pointer"
                style={{ zIndex: 2 }}
              />
              <div className="flex justify-between">
                <span className="text-[11px] text-white/35 tabular-nums">
                  {formatTime(currentTime)}
                </span>
                <span className="text-[11px] text-white/35 tabular-nums">
                  {duration > 0 ? `-${formatTime(duration - currentTime)}` : "0:00"}
                </span>
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-between mb-6 px-2">
              <button
                onClick={toggleShuffle}
                className={`p-3 rounded-full hover:bg-white/10 active:scale-90 transition-all ${shuffle ? "text-green-400" : "text-white/40"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M17.28 3.22a.75.75 0 0 1 0 1.06l-1.72 1.72h.69a6.75 6.75 0 0 1 5.527 2.872.75.75 0 1 1-1.228.862A5.25 5.25 0 0 0 16.25 7.5h-.69l1.72 1.72a.75.75 0 1 1-1.06 1.06l-3-3a.75.75 0 0 1 0-1.06l3-3a.75.75 0 0 1 1.06 0ZM17.28 13.72a.75.75 0 0 1 0 1.06l-1.72 1.72h.69a5.25 5.25 0 0 0 4.297-2.234.75.75 0 1 1 1.228.862A6.75 6.75 0 0 1 16.25 18h-.69l1.72 1.72a.75.75 0 1 1-1.06 1.06l-3-3a.75.75 0 0 1 0-1.06l3-3a.75.75 0 0 1 1.06 0ZM2.25 7.5a.75.75 0 0 1 .75-.75h4.36a6.75 6.75 0 0 1 5.19 2.438l4.078 4.874A5.25 5.25 0 0 0 20.68 16.5h.57a.75.75 0 0 1 0 1.5h-.57a6.75 6.75 0 0 1-5.19-2.438L11.41 10.69A5.25 5.25 0 0 0 7.36 8.25H3a.75.75 0 0 1-.75-.75ZM2.25 16.5a.75.75 0 0 1 .75-.75h4.36a5.25 5.25 0 0 0 4.05-1.898l.47-.562a.75.75 0 0 1 1.149.978l-.47.562A6.75 6.75 0 0 1 7.36 17.25H3a.75.75 0 0 1-.75-.75ZM7.36 8.25a5.25 5.25 0 0 1 4.05 1.898l.47.562a.75.75 0 0 1-1.149.978l-.47-.562A3.75 3.75 0 0 0 7.36 9.75H3a.75.75 0 0 1 0-1.5h4.36Z" />
                </svg>
              </button>

              <button
                onClick={prevTrack}
                className="p-3 rounded-full hover:bg-white/10 active:scale-90 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white/80">
                  <path d="M9.195 18.44c1.25.714 2.805-.189 2.805-1.629v-2.34l6.945 3.968c1.25.715 2.805-.188 2.805-1.628V7.19c0-1.44-1.555-2.343-2.805-1.628L12 9.53v-2.34c0-1.44-1.555-2.343-2.805-1.628l-7.108 4.061c-1.26.72-1.26 2.536 0 3.256l7.108 4.061Z" />
                </svg>
              </button>

              <button
                onClick={togglePlay}
                disabled={isLoading}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg shadow-white/10"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : isPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-black ml-0">
                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-black ml-1">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <button
                onClick={nextTrack}
                className="p-3 rounded-full hover:bg-white/10 active:scale-90 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white/80">
                  <path d="M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v6.622c0 1.44 1.555 2.343 2.805 1.628L12 12.97v2.34c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256l-7.108-4.06C13.555 4.846 12 5.75 12 7.19v2.34L5.055 5.44a.002.002 0 0 0 0 0l-.001.002L5.055 7.06Z" />
                </svg>
              </button>

              <button
                onClick={toggleRepeat}
                className={`p-3 rounded-full hover:bg-white/10 active:scale-90 transition-all relative ${repeat !== "off" ? "text-green-400" : "text-white/40"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M16.5 3.75a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75V4.5a.75.75 0 0 1 .75-.75ZM7.5 20.25a.75.75 0 0 1-.75-.75v-3.75H3a.75.75 0 0 1 0-1.5h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75ZM19.08 6.22a7.463 7.463 0 0 0-5.296-2.194A7.5 7.5 0 0 0 6.221 19.08a.75.75 0 0 0 1.06-1.06 6 6 0 1 1 8.486-8.486.75.75 0 0 0 1.06-1.061l.254-2.254ZM4.92 17.78a7.463 7.463 0 0 0 5.296 2.194A7.5 7.5 0 0 0 17.779 4.92a.75.75 0 0 0-1.06 1.06 6 6 0 1 1-8.486 8.486.75.75 0 0 0-1.06 1.061l-.254 2.254Z" />
                </svg>
                {repeat === "one" && (
                  <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold text-green-400">1</span>
                )}
              </button>
            </div>

            {/* Bottom row: Volume, EQ, Lyrics */}
            <div className="flex items-center gap-3 px-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white/30 flex-shrink-0">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Z" />
              </svg>
              <VolumeSlider />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white/30 flex-shrink-0">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
              </svg>

              <button
                onClick={() => setShowEQ(true)}
                className={`ml-1 p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all ${eqEnabled ? "text-green-400" : "text-white/30"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                </svg>
              </button>

              <button
                onClick={() => setShowLyrics(true)}
                className="p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all text-white/30 hover:text-white/50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </button>
            </div>
          </>
        )}

        {/* ===== VIDEO MODE ===== */}
        {viewMode === "video" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Video embed with prev/next navigation — shrinks when lyrics are open */}
            <div className={`relative w-full rounded-2xl overflow-hidden shadow-2xl bg-black transition-all duration-300 ${
              showInlineLyrics ? "h-[30vh] flex-shrink-0" : "aspect-video flex-shrink-0"
            }`}>
              {/* Video container — ALWAYS in the DOM so the ref is available for YT.Player */}
              <div ref={videoContainerRef} className="w-full h-full" />

              {/* Overlay states on top of the video container */}
              {videoLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                    <p className="text-[12px] text-white/40">Finding music video...</p>
                  </div>
                </div>
              )}
              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/20">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z" clipRule="evenodd" />
                    </svg>
                    <p className="text-[13px] text-white/40">Video can&apos;t be played</p>
                    {videoOptions.length > 1 && (
                      <button
                        onClick={() => switchVideo(videoIndex + 1 < videoOptions.length ? videoIndex + 1 : 0)}
                        className="text-[12px] text-green-400 hover:text-green-300 font-medium transition-colors"
                      >
                        Try another video →
                      </button>
                    )}
                    <a
                      href={`https://www.youtube.com/watch?v=${musicVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400/60 hover:text-blue-300 underline transition-colors mt-1"
                    >
                      Watch on YouTube
                    </a>
                  </div>
                </div>
              )}
              {!videoLoading && !videoError && !musicVideoId && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/20">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z" clipRule="evenodd" />
                    </svg>
                    <p className="text-[13px] text-white/40">No music video found</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl ring-1 ring-white/[0.08] pointer-events-none" />

              {/* Prev/Next video arrows — shown over the video */}
              {videoOptions.length > 1 && !videoLoading && !videoError && (
                <>
                  {videoIndex > 0 && (
                    <button
                      onClick={() => switchVideo(videoIndex - 1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-all z-10 active:scale-90"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-white/80">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                  )}
                  {videoIndex < videoOptions.length - 1 && (
                    <button
                      onClick={() => switchVideo(videoIndex + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-all z-10 active:scale-90"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-white/80">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Video options horizontal scroll — shown below video when there are alternatives */}
            {videoOptions.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 flex-shrink-0">
                {videoOptions.map((opt, i) => (
                  <button
                    key={opt.videoId}
                    onClick={() => switchVideo(i)}
                    className={`flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                      i === videoIndex
                        ? "bg-white/[0.12] ring-1 ring-white/20"
                        : "bg-white/[0.04] hover:bg-white/[0.08]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={opt.thumbnail}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-10 h-6 rounded object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 max-w-[120px]">
                      <p className={`text-[10px] truncate font-medium ${i === videoIndex ? "text-white" : "text-white/50"}`}>
                        {opt.title}
                      </p>
                      <p className="text-[9px] text-white/30 truncate">{opt.artist}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Compact song info + lyrics toggle */}
            <div className="flex items-center justify-between py-2 flex-shrink-0">
              <div className="flex-1 min-w-0 mr-3">
                <h2 className="text-[16px] font-bold truncate leading-tight">
                  {currentSong.title}
                </h2>
                <p
                  onClick={handleArtistClick}
                  className="text-[13px] text-white/50 truncate mt-0.5 hover:text-white/70 hover:underline transition-colors cursor-pointer"
                >
                  {currentSong.artist}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleLike(currentSong)}
                  className="p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={liked ? 0 : 1.5} className={`w-5 h-5 ${liked ? "text-pink-400" : "text-white/50"}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                  </svg>
                </button>
                {/* Inline lyrics toggle */}
                <button
                  onClick={() => setShowInlineLyrics((v) => !v)}
                  className={`p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all ${showInlineLyrics ? "text-green-400" : "text-white/30 hover:text-white/50"}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Inline lyrics area (below video) */}
            {showInlineLyrics && (
              <InlineLyricsScroller
                videoTime={videoTime}
                songTitle={currentSong.title}
                songArtist={currentSong.artist}
                duration={duration}
                seek={seek}
              />
            )}
          </div>
        )}
      </div>

      {/* EQ Panel */}
      {showEQ && <EQPanel onClose={() => setShowEQ(false)} />}

      {/* Lyrics Panel (full-screen overlay, song mode only) */}
      {showLyrics && viewMode === "song" && (
        <LyricsPanel
          onClose={() => setShowLyrics(false)}
          overrideTime={undefined}
        />
      )}
    </div>
  );
}

function VolumeSlider() {
  const { volume, setVolume } = useAudioPlayer();

  return (
    <div className="flex-1 relative h-6 flex items-center">
      <div className="w-full h-1 bg-white/[0.12] rounded-full overflow-hidden">
        <div
          className="h-full bg-white/50 rounded-full"
          style={{ width: `${volume * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="absolute w-full opacity-0 h-6 cursor-pointer"
      />
    </div>
  );
}
