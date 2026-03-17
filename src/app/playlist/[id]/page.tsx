"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getPlaylistDetails, PlaylistDetails } from "@/services/pipedApi";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Song } from "@/types/song";
import SongCard from "@/components/SongCard";

export default function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { playSong } = useAudioPlayer();
  const [data, setData] = useState<PlaylistDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState("80, 80, 120");

  const extractColor = useCallback((thumbnail: string) => {
    if (typeof window === "undefined" || !thumbnail) return;
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
        setDominantColor(`${Math.min(255, r + 20)}, ${Math.min(255, g + 20)}, ${Math.min(255, b + 20)}`);
      } catch {
        // CORS error
      }
    };
    img.src = thumbnail;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPlaylistDetails(id)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
          if (result.playlist.thumbnail) {
            extractColor(result.playlist.thumbnail);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Playlist fetch error:", err);
          setError("Failed to load playlist");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [id, extractColor]);

  if (loading) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        <p className="text-[13px] text-white/30">Loading playlist...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center min-h-screen gap-3 px-5">
        <p className="text-[15px] text-white/50">{error || "Playlist not found"}</p>
        <button
          onClick={() => router.back()}
          className="mt-2 px-4 py-2 rounded-xl bg-white/[0.07] text-[13px] text-white/60 hover:bg-white/[0.12] transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  const { playlist, songs } = data;

  const songQueue: Song[] = songs.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    artistRefs: s.artistIds?.map((a) => ({ id: a.id, name: a.name })),
    thumbnail: s.thumbnail,
    duration: s.duration,
    sourceContext: {
      type: "playlist" as const,
      id: playlist.id,
      title: playlist.title,
    },
  }));

  return (
    <div className="animate-fadeIn pb-40">
      {/* Gradient background */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-colors duration-[2s]"
        style={{
          background: `radial-gradient(ellipse at 50% 0%,
            rgba(${dominantColor}, 0.25) 0%,
            rgba(${dominantColor}, 0.08) 35%,
            transparent 65%)`,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="px-5 pt-14 pb-6">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 mb-4 rounded-full hover:bg-white/10 active:scale-90 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 text-white/80">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="flex gap-5">
            {/* Playlist cover */}
            <div className="relative w-[130px] h-[130px] flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06] shadow-xl">
              {playlist.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={playlist.thumbnail}
                  alt={playlist.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white/20">
                    <path fillRule="evenodd" d="m19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.403-4.909l2.311-.66a1.5 1.5 0 0 0 1.088-1.442V6.994l-9 2.572v9.737a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.402-4.909l2.31-.66a1.5 1.5 0 0 0 1.088-1.442V5.25a.75.75 0 0 1 .544-.721l10.5-3a.75.75 0 0 1 .658.122Z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 rounded-xl ring-1 ring-white/[0.08]" />
            </div>

            {/* Playlist info */}
            <div className="flex-1 min-w-0 flex flex-col justify-end">
              <h1 className="text-[22px] font-bold tracking-tight leading-tight line-clamp-2">
                {playlist.title}
              </h1>
              {playlist.author && (
                <p className="text-[13px] text-white/40 mt-1 truncate">
                  {playlist.author}
                </p>
              )}
              <p className="text-[12px] text-white/25 mt-0.5">
                {songQueue.length} {songQueue.length === 1 ? "song" : "songs"}
              </p>
            </div>
          </div>
        </div>

        {/* Play buttons */}
        {songQueue.length > 0 && (
          <div className="px-5 flex items-center gap-3 mb-6">
            <button
              onClick={() => playSong(songQueue[0], songQueue)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 text-[13px] font-semibold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
              </svg>
              Play All
            </button>
            <button
              onClick={() => {
                const shuffled = [...songQueue].sort(() => Math.random() - 0.5);
                playSong(shuffled[0], shuffled);
              }}
              className="p-3 rounded-full bg-white/[0.06] hover:bg-white/[0.1] active:scale-90 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white/70">
                <path d="M17.28 3.22a.75.75 0 0 1 0 1.06l-1.72 1.72h.69a6.75 6.75 0 0 1 5.527 2.872.75.75 0 1 1-1.228.862A5.25 5.25 0 0 0 16.25 7.5h-.69l1.72 1.72a.75.75 0 1 1-1.06 1.06l-3-3a.75.75 0 0 1 0-1.06l3-3a.75.75 0 0 1 1.06 0ZM17.28 13.72a.75.75 0 0 1 0 1.06l-1.72 1.72h.69a5.25 5.25 0 0 0 4.297-2.234.75.75 0 1 1 1.228.862A6.75 6.75 0 0 1 16.25 18h-.69l1.72 1.72a.75.75 0 1 1-1.06 1.06l-3-3a.75.75 0 0 1 0-1.06l3-3a.75.75 0 0 1 1.06 0ZM2.25 7.5a.75.75 0 0 1 .75-.75h4.36a6.75 6.75 0 0 1 5.19 2.438l4.078 4.874A5.25 5.25 0 0 0 20.68 16.5h.57a.75.75 0 0 1 0 1.5h-.57a6.75 6.75 0 0 1-5.19-2.438L11.41 10.69A5.25 5.25 0 0 0 7.36 8.25H3a.75.75 0 0 1-.75-.75Z" />
              </svg>
            </button>
          </div>
        )}

        {/* Songs */}
        <div className="px-5">
          <div className="space-y-0.5">
            {songQueue.map((song, i) => (
              <div key={`${song.id}-${i}`} className="flex items-center gap-1">
                <span className="text-[12px] text-white/20 w-6 text-center tabular-nums flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <SongCard song={song} queue={songQueue} />
                </div>
              </div>
            ))}
          </div>

          {songQueue.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-[14px] text-white/40">No songs in this playlist</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
