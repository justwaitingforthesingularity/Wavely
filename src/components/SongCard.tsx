"use client";

import { useRouter } from "next/navigation";
import { Song } from "@/types/song";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useLibrary } from "@/hooks/useLibrary";
import { formatTime } from "@/services/audioPlayer";

interface SongCardProps {
  song: Song;
  queue?: Song[];
  index?: number;
}

export default function SongCard({ song, queue }: SongCardProps) {
  const router = useRouter();
  const { playSong, currentSong, isPlaying } = useAudioPlayer();
  const { isLiked, toggleLike } = useLibrary();
  const isActive = currentSong?.id === song.id;
  const liked = isLiked(song.id);

  const handleArtistClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to the first artist's page if we have artist refs
    if (song.artistRefs && song.artistRefs.length > 0) {
      router.push(`/artist/${song.artistRefs[0].id}`);
      return;
    }
    // Fallback: search for artist by name
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(song.artist)}&type=artist`);
      const data = await res.json();
      if (data.artists && data.artists.length > 0) {
        router.push(`/artist/${data.artists[0].id}`);
      }
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={() => playSong(song, queue)}
      className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-200 active:scale-[0.98] ${
        isActive
          ? "bg-white/[0.08]"
          : "hover:bg-white/[0.04]"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={song.thumbnail}
          alt={song.title}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        {isActive && isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="flex items-end gap-[2px] h-3">
              <span className="w-[3px] bg-white rounded-full animate-pulse-soft" style={{ height: '60%', animationDelay: '0ms' }} />
              <span className="w-[3px] bg-white rounded-full animate-pulse-soft" style={{ height: '100%', animationDelay: '150ms' }} />
              <span className="w-[3px] bg-white rounded-full animate-pulse-soft" style={{ height: '40%', animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className={`text-[14px] font-medium truncate leading-tight ${
          isActive ? "text-emerald-400" : "text-white"
        }`}>
          {song.title}
        </p>
        <p
          onClick={handleArtistClick}
          className="text-[12px] text-white/45 truncate mt-0.5 hover:text-white/70 hover:underline transition-colors cursor-pointer"
        >
          {song.artist}
        </p>
      </div>

      {/* Like button */}
      {liked && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(song);
          }}
          className="flex-shrink-0 p-1 rounded-full hover:bg-white/10 active:scale-90 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-pink-400">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        </div>
      )}

      {/* Duration */}
      <span className="text-[11px] text-white/30 tabular-nums flex-shrink-0 pr-1">
        {formatTime(song.duration)}
      </span>
    </button>
  );
}
