"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Song } from "@/types/song";
import SongCard from "@/components/SongCard";

const GENRE_MAP: Record<string, { name: string; color: string; gradient: string }> = {
  "pop": {
    name: "Pop",
    color: "236, 72, 153",
    gradient: "from-pink-500/40 to-rose-600/20",
  },
  "hip-hop": {
    name: "Hip-Hop",
    color: "245, 158, 11",
    gradient: "from-orange-500/40 to-amber-600/20",
  },
  "rock": {
    name: "Rock",
    color: "239, 68, 68",
    gradient: "from-red-500/40 to-red-700/20",
  },
  "r-and-b": {
    name: "R&B",
    color: "168, 85, 247",
    gradient: "from-purple-500/40 to-violet-600/20",
  },
  "electronic": {
    name: "Electronic",
    color: "59, 130, 246",
    gradient: "from-blue-500/40 to-cyan-600/20",
  },
  "jazz": {
    name: "Jazz",
    color: "217, 166, 36",
    gradient: "from-amber-500/40 to-yellow-600/20",
  },
  "classical": {
    name: "Classical",
    color: "20, 184, 166",
    gradient: "from-teal-500/40 to-emerald-600/20",
  },
  "lo-fi": {
    name: "Lo-Fi",
    color: "99, 102, 241",
    gradient: "from-indigo-500/40 to-purple-600/20",
  },
};

interface GenrePlaylist {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
}

interface GenreArtist {
  id: string;
  name: string;
  thumbnail: string;
}

interface GenreData {
  playlists: {
    official: GenrePlaylist[];
    community: GenrePlaylist[];
  };
  artists: GenreArtist[];
  trending: Song[];
}

export default function GenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { playSong } = useAudioPlayer();
  const [data, setData] = useState<GenreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const genre = GENRE_MAP[slug];
  const genreName = genre?.name || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const genreColor = genre?.color || "100, 100, 140";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/genre?genre=${encodeURIComponent(genreName)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch genre data");
        return res.json();
      })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Genre fetch error:", err);
          setError("Failed to load genre");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [genreName]);

  if (loading) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        <p className="text-[13px] text-white/30">Loading {genreName}...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center min-h-screen gap-3 px-5">
        <p className="text-[15px] text-white/50">{error || "Genre not found"}</p>
        <button
          onClick={() => router.back()}
          className="mt-2 px-4 py-2 rounded-xl bg-white/[0.07] text-[13px] text-white/60 hover:bg-white/[0.12] transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  const { playlists, artists, trending } = data;
  const officialPlaylists = playlists?.official || [];
  const communityPlaylists = playlists?.community || [];
  const allPlaylists = [...officialPlaylists, ...communityPlaylists];

  const PlaylistRow = ({ items, label }: { items: GenrePlaylist[]; label?: string }) => (
    <section className="mb-8">
      {label && <h2 className="text-[18px] font-semibold mb-4 px-5">{label}</h2>}
      <div className="flex gap-4 overflow-x-auto pb-2 px-5 scrollbar-hide">
        {items.map((playlist) => (
          <button
            key={playlist.id}
            onClick={() => router.push(`/playlist/${playlist.id}`)}
            className="flex-shrink-0 w-[150px] group text-left"
          >
            <div className="relative w-[150px] h-[150px] rounded-xl overflow-hidden bg-white/[0.06] mb-2.5">
              {playlist.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={playlist.thumbnail}
                  alt={playlist.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-white/[0.04]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/15">
                    <path fillRule="evenodd" d="m19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.403-4.909l2.311-.66a1.5 1.5 0 0 0 1.088-1.442V6.994l-9 2.572v9.737a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.402-4.909l2.31-.66a1.5 1.5 0 0 0 1.088-1.442V5.25a.75.75 0 0 1 .544-.721l10.5-3a.75.75 0 0 1 .658.122Z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 rounded-xl ring-1 ring-white/[0.06]" />
            </div>
            <p className="text-[13px] font-medium text-white/90 truncate leading-tight">
              {playlist.title}
            </p>
            <p className="text-[11px] text-white/35 truncate mt-0.5">
              {playlist.author}
            </p>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="animate-fadeIn pb-40">
      {/* Gradient background */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-colors duration-[2s]"
        style={{
          background: `radial-gradient(ellipse at 50% 0%,
            rgba(${genreColor}, 0.35) 0%,
            rgba(${genreColor}, 0.12) 35%,
            transparent 65%)`,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="relative overflow-hidden">
          {/* Genre gradient hero */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg,
                rgba(${genreColor}, 0.4) 0%,
                rgba(${genreColor}, 0.15) 50%,
                transparent 100%)`,
            }}
          />

          <div className="relative px-5 pt-14 pb-10">
            {/* Back button */}
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 mb-6 rounded-full hover:bg-white/10 active:scale-90 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 text-white/80">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>

            <h1 className="text-[36px] font-bold tracking-tight drop-shadow-lg">
              {genreName}
            </h1>
            <p className="text-[14px] text-white/45 mt-1">
              Explore the best of {genreName}
            </p>
          </div>
        </div>

        {/* Official Playlists */}
        {officialPlaylists.length > 0 && (
          <PlaylistRow items={officialPlaylists} label="Official Playlists" />
        )}

        {/* Community Playlists */}
        {communityPlaylists.length > 0 && (
          <PlaylistRow items={communityPlaylists} label="Community Playlists" />
        )}

        {/* If no split, show all together */}
        {officialPlaylists.length === 0 && communityPlaylists.length === 0 && allPlaylists.length > 0 && (
          <PlaylistRow items={allPlaylists} label="Popular Playlists" />
        )}

        {/* Popular Artists */}
        {artists && artists.length > 0 && (
          <section className="px-5 mb-8">
            <h2 className="text-[18px] font-semibold mb-4">Popular Artists</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {artists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => router.push(`/artist/${artist.id}`)}
                  className="flex-shrink-0 flex flex-col items-center gap-2.5 w-[100px] group"
                >
                  <div className="relative w-[100px] h-[100px] rounded-full overflow-hidden bg-white/[0.06]">
                    {artist.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={artist.thumbnail}
                        alt={artist.name}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/20">
                          <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full ring-1 ring-white/[0.08]" />
                  </div>
                  <span className="text-[12px] text-white/70 text-center leading-tight line-clamp-2 group-hover:text-white transition-colors">
                    {artist.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Trending Songs */}
        {trending && trending.length > 0 && (
          <section className="px-5 mb-8">
            <h2 className="text-[18px] font-semibold mb-3">Trending</h2>
            <div className="space-y-0.5">
              {trending.map((song, i) => (
                <div key={`${song.id}-${i}`} className="flex items-center gap-1">
                  <span className="text-[12px] text-white/20 w-6 text-center tabular-nums flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <SongCard song={song} queue={trending} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {allPlaylists.length === 0 &&
         (!artists || artists.length === 0) &&
         (!trending || trending.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white/15">
              <path fillRule="evenodd" d="m19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.403-4.909l2.311-.66a1.5 1.5 0 0 0 1.088-1.442V6.994l-9 2.572v9.737a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.402-4.909l2.31-.66a1.5 1.5 0 0 0 1.088-1.442V5.25a.75.75 0 0 1 .544-.721l10.5-3a.75.75 0 0 1 .658.122Z" clipRule="evenodd" />
            </svg>
            <p className="text-[14px] text-white/40">No content found for {genreName}</p>
          </div>
        )}
      </div>
    </div>
  );
}
