"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useLibrary } from "@/hooks/useLibrary";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import SongCard from "@/components/SongCard";

export default function LocalPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { playlists, deletePlaylist, removeFromPlaylist } = useLibrary();
  const { playSong } = useAudioPlayer();
  const [dominantColor, setDominantColor] = useState("120, 80, 160");

  const playlist = playlists.find((p) => p.id === id);

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

  // Extract color from the first song's thumbnail
  if (playlist && playlist.songs.length > 0 && dominantColor === "120, 80, 160") {
    extractColor(playlist.songs[0].thumbnail);
  }

  if (!playlist) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center min-h-screen gap-3 px-5">
        <p className="text-[15px] text-white/50">Playlist not found</p>
        <button
          onClick={() => router.back()}
          className="mt-2 px-4 py-2 rounded-xl bg-white/[0.07] text-[13px] text-white/60 hover:bg-white/[0.12] transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  // Build a mosaic thumbnail from the first 4 songs
  const coverSongs = playlist.songs.slice(0, 4);

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
            {/* Playlist cover — mosaic of first 4 songs or gradient icon */}
            <div className="relative w-[130px] h-[130px] flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06] shadow-xl">
              {coverSongs.length >= 4 ? (
                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                  {coverSongs.map((s, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={i}
                      src={s.thumbnail}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              ) : coverSongs.length > 0 ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={coverSongs[0].thumbnail}
                  alt={playlist.name}
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
                {playlist.name}
              </h1>
              <p className="text-[13px] text-white/40 mt-1">
                Playlist
              </p>
              <p className="text-[12px] text-white/25 mt-0.5">
                {playlist.songs.length} {playlist.songs.length === 1 ? "song" : "songs"}
              </p>
            </div>
          </div>
        </div>

        {/* Play buttons */}
        {playlist.songs.length > 0 && (
          <div className="px-5 flex items-center gap-3 mb-6">
            <button
              onClick={() => playSong(playlist.songs[0], playlist.songs)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 text-[13px] font-semibold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
              </svg>
              Play All
            </button>
            <button
              onClick={() => {
                const shuffled = [...playlist.songs].sort(() => Math.random() - 0.5);
                playSong(shuffled[0], shuffled);
              }}
              className="p-3 rounded-full bg-white/[0.06] hover:bg-white/[0.1] active:scale-90 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white/70">
                <path d="M17.28 3.22a.75.75 0 0 1 0 1.06l-1.72 1.72h.69a6.75 6.75 0 0 1 5.527 2.872.75.75 0 1 1-1.228.862A5.25 5.25 0 0 0 16.25 7.5h-.69l1.72 1.72a.75.75 0 1 1-1.06 1.06l-3-3a.75.75 0 0 1 0-1.06l3-3a.75.75 0 0 1 1.06 0ZM17.28 13.72a.75.75 0 0 1 0 1.06l-1.72 1.72h.69a5.25 5.25 0 0 0 4.297-2.234.75.75 0 1 1 1.228.862A6.75 6.75 0 0 1 16.25 18h-.69l1.72 1.72a.75.75 0 1 1-1.06 1.06l-3-3a.75.75 0 0 1 0-1.06l3-3a.75.75 0 0 1 1.06 0ZM2.25 7.5a.75.75 0 0 1 .75-.75h4.36a6.75 6.75 0 0 1 5.19 2.438l4.078 4.874A5.25 5.25 0 0 0 20.68 16.5h.57a.75.75 0 0 1 0 1.5h-.57a6.75 6.75 0 0 1-5.19-2.438L11.41 10.69A5.25 5.25 0 0 0 7.36 8.25H3a.75.75 0 0 1-.75-.75Z" />
              </svg>
            </button>
            {/* Delete playlist */}
            <button
              onClick={() => {
                if (confirm(`Delete "${playlist.name}"?`)) {
                  deletePlaylist(playlist.id);
                  router.back();
                }
              }}
              className="ml-auto p-3 rounded-full bg-white/[0.06] hover:bg-white/[0.1] active:scale-90 transition-all"
              title="Delete playlist"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-white/40">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        )}

        {/* Songs */}
        <div className="px-5">
          <div className="space-y-0.5">
            {playlist.songs.map((song, i) => (
              <div key={`${song.id}-${i}`} className="flex items-center gap-1 group">
                <span className="text-[12px] text-white/20 w-6 text-center tabular-nums flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <SongCard song={song} queue={playlist.songs} />
                </div>
                {/* Remove from playlist */}
                <button
                  onClick={() => removeFromPlaylist(playlist.id, song.id)}
                  className="flex-shrink-0 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/10 active:scale-90 transition-all"
                  title="Remove from playlist"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-white/30">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {playlist.songs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-7 h-7 text-white/15">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                </svg>
              </div>
              <p className="text-[14px] text-white/40">No songs yet</p>
              <p className="text-[12px] text-white/20">Add songs from the player menu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
