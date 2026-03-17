"use client";

import { useRouter } from "next/navigation";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

export default function MiniPlayer() {
  const router = useRouter();
  const {
    currentSong,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    dominantColor,
    togglePlay,
    openPlayer,
  } = useAudioPlayer();

  if (!currentSong) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleArtistClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentSong.artistRefs && currentSong.artistRefs.length > 0) {
      router.push(`/artist/${currentSong.artistRefs[0].id}`);
      return;
    }
    // Fallback: search by artist name
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(currentSong.artist)}&type=artist`);
      const data = await res.json();
      if (data.artists && data.artists.length > 0) {
        router.push(`/artist/${data.artists[0].id}`);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed left-2 right-2 z-50 animate-slideUp" style={{ bottom: 'calc(var(--nav-height) + 8px)' }}>
      {/* Container with glass effect */}
      <div
        className="rounded-2xl overflow-hidden shadow-lg shadow-black/40"
        style={{
          background: `linear-gradient(135deg,
            rgba(${dominantColor}, 0.25) 0%,
            rgba(25, 25, 30, 0.85) 100%)`,
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        {/* Progress bar — thin line at top */}
        <div className="h-[2px] bg-white/[0.06]">
          <div
            className="h-full bg-white/60 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <button
          onClick={openPlayer}
          className="flex w-full items-center gap-3 p-2.5 pr-3 text-left active:opacity-80 transition-opacity"
        >
          {/* Album art */}
          <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentSong.thumbnail}
              alt={currentSong.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              </div>
            )}
            <div className="absolute inset-0 rounded-xl ring-1 ring-white/[0.08]" />
          </div>

          {/* Song info */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate leading-tight text-white">
              {currentSong.title}
            </p>
            <p
              onClick={handleArtistClick}
              className="text-[11px] text-white/40 truncate mt-0.5 hover:text-white/60 hover:underline transition-colors cursor-pointer"
            >
              {currentSong.artist}
            </p>
          </div>

          {/* Play/Pause button */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="p-2 rounded-full hover:bg-white/10 active:scale-90 transition-all"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
