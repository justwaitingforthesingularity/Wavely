"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getArtistDetails, ArtistDetails } from "@/services/pipedApi";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useLibrary } from "@/hooks/useLibrary";
import { Song } from "@/types/song";
import SongCard from "@/components/SongCard";

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

export default function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { playSong } = useAudioPlayer();
  const { toggleFollow, isFollowing } = useLibrary();
  const [data, setData] = useState<ArtistDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [dominantColor, setDominantColor] = useState("80, 80, 120");
  const [descExpanded, setDescExpanded] = useState(false);

  // Extract dominant color from artist thumbnail
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

    getArtistDetails(id)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
          if (result.artist.thumbnail) {
            extractColor(result.artist.thumbnail);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Artist fetch error:", err);
          setError("Failed to load artist");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [id, extractColor]);

  if (loading) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        <p className="text-[13px] text-white/30">Loading artist...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center min-h-screen gap-3 px-5">
        <p className="text-[15px] text-white/50">{error || "Artist not found"}</p>
        <button
          onClick={() => router.back()}
          className="mt-2 px-4 py-2 rounded-xl bg-white/[0.07] text-[13px] text-white/60 hover:bg-white/[0.12] transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  const { artist, topSongs, albums, videos, relatedArtists } = data;
  const following = isFollowing(artist.id);

  const songQueue: Song[] = topSongs.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    thumbnail: s.thumbnail,
    duration: s.duration,
    artistRefs: [{ id: artist.id, name: artist.name }],
  }));

  const videoSongs: Song[] = (videos || []).map((v) => ({
    id: v.id,
    title: v.title,
    artist: v.artist,
    thumbnail: v.thumbnail,
    duration: v.duration,
    musicVideoId: v.id,
    artistRefs: [{ id: artist.id, name: artist.name }],
  }));

  const displayedSongs = showAllSongs ? songQueue : songQueue.slice(0, 5);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="animate-fadeIn pb-40">
      {/* Dynamic gradient background that extends behind hero */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-colors duration-[2s]"
        style={{
          background: `radial-gradient(ellipse at 50% 0%,
            rgba(${dominantColor}, 0.3) 0%,
            rgba(${dominantColor}, 0.1) 35%,
            transparent 65%)`,
        }}
      />

      {/* Hero section with artist image */}
      <div className="relative z-10">
        {/* Background image */}
        <div className="relative h-[320px] overflow-hidden">
          {artist.thumbnail ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getHQThumbnail(artist.thumbnail)}
                alt={artist.name}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Gradient overlay - uses dominant color for a beautiful blend */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg,
                    rgba(${dominantColor}, 0.15) 0%,
                    transparent 30%,
                    rgba(10, 10, 12, 0.6) 65%,
                    rgb(10, 10, 12) 100%)`,
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg,
                  rgba(${dominantColor}, 0.3) 0%,
                  rgb(10, 10, 12) 100%)`,
              }}
            />
          )}

          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="absolute top-12 left-5 z-10 p-2 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 active:scale-90 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Blur overlay — outside overflow-hidden so it spans the hero→content boundary with no visible edges */}
        {artist.thumbnail && (
          <div
            className="absolute inset-x-0 bottom-[-55px] h-[160px] pointer-events-none z-20"
            style={{
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              maskImage: "linear-gradient(to bottom, transparent 0%, black 35%, black 65%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 35%, black 65%, transparent 100%)",
            }}
          />
        )}

        {/* Artist info overlay at bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          <h1 className="text-[32px] font-bold tracking-tight drop-shadow-lg">
            {artist.name}
          </h1>
          {artist.subscribers && (
            <p className="text-[13px] text-white/50 mt-1 drop-shadow-sm">
              {artist.subscribers}
            </p>
          )}
        </div>
      </div>

      {/* Rest of content */}
      <div className="relative z-10">
        {/* Action buttons */}
        <div className="px-5 flex items-center gap-3 mt-4 mb-6">
          <button
            onClick={() => toggleFollow({
              id: artist.id,
              name: artist.name,
              thumbnail: artist.thumbnail,
              subscribers: artist.subscribers,
            })}
            className={`px-6 py-2.5 rounded-full text-[13px] font-semibold transition-all active:scale-95 ${
              following
                ? "bg-white/[0.08] text-white border border-white/[0.15] hover:bg-white/[0.12]"
                : "bg-white text-black hover:bg-white/90"
            }`}
          >
            {following ? "Following" : "Follow"}
          </button>

          {songQueue.length > 0 && (
            <>
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
              <button
                onClick={() => playSong(songQueue[0], songQueue)}
                className="p-3 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-90 transition-all shadow-lg shadow-emerald-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Description */}
        {artist.description && (
          <div className="px-5 mb-6">
            <p
              onClick={() => setDescExpanded(!descExpanded)}
              className={`text-[13px] text-white/40 leading-relaxed cursor-pointer transition-all duration-300 ${descExpanded ? "" : "line-clamp-3"}`}
            >
              {artist.description}
            </p>
          </div>
        )}

        {/* Top Songs */}
        {songQueue.length > 0 && (
          <section className="px-5 mb-8">
            <h2 className="text-[18px] font-semibold mb-3">Popular</h2>
            <div className="space-y-0.5">
              {displayedSongs.map((song, i) => (
                <div key={song.id} className="flex items-center gap-1">
                  <span className="text-[12px] text-white/20 w-6 text-center tabular-nums flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <SongCard song={song} queue={songQueue} />
                  </div>
                </div>
              ))}
            </div>
            {songQueue.length > 5 && (
              <button
                onClick={() => setShowAllSongs(!showAllSongs)}
                className="mt-3 text-[13px] text-white/40 hover:text-white/60 transition-colors font-medium"
              >
                {showAllSongs ? "Show less" : `See all ${songQueue.length} songs`}
              </button>
            )}
          </section>
        )}

        {/* Albums & Singles */}
        {albums && albums.length > 0 && (
          <section className="px-5 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-semibold">Discography</h2>
              {albums.length > 3 && (
                <button
                  onClick={() => setShowAllAlbums(!showAllAlbums)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.09] text-[12px] text-white/40 hover:text-white/60 transition-all duration-200"
                >
                  {showAllAlbums ? "Show less" : "See all"}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className={`w-3 h-3 transition-transform duration-200 ${showAllAlbums ? "rotate-180" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              )}
            </div>

            {showAllAlbums ? (
              /* Grid view for full discography */
              <div className="grid grid-cols-2 gap-4">
                {albums.map((album, i) => (
                  <button
                    key={album.id || `album-${i}`}
                    onClick={() => album.id && router.push(`/album/${album.id}`)}
                    className="text-left group"
                  >
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-white/[0.06] mb-2.5">
                      {album.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={album.thumbnail}
                          alt={album.title}
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
                      {album.title}
                    </p>
                    <p className="text-[11px] text-white/35 truncate mt-0.5">
                      {album.year}{album.type ? ` \u00B7 ${album.type}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              /* Horizontal scroll for compact view */
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {albums.slice(0, 6).map((album, i) => (
                  <button
                    key={album.id || `album-${i}`}
                    onClick={() => album.id && router.push(`/album/${album.id}`)}
                    className="flex-shrink-0 w-[140px] group text-left"
                  >
                    <div className="relative w-[140px] h-[140px] rounded-xl overflow-hidden bg-white/[0.06] mb-2.5">
                      {album.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={album.thumbnail}
                          alt={album.title}
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
                      {album.title}
                    </p>
                    <p className="text-[11px] text-white/35 truncate mt-0.5">
                      {album.year}{album.type ? ` \u00B7 ${album.type}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Music Videos */}
        {videoSongs.length > 0 && (
          <section className="px-5 mb-8">
            <h2 className="text-[18px] font-semibold mb-4">Music Videos</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {videoSongs.map((video) => (
                <button
                  key={video.id}
                  onClick={() => playSong(video, videoSongs)}
                  className="flex-shrink-0 w-[200px] group text-left"
                >
                  <div className="relative w-[200px] h-[112px] rounded-xl overflow-hidden bg-white/[0.06] mb-2.5">
                    {video.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/[0.04]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/15">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white ml-0.5">
                          <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    {/* Duration badge */}
                    {video.duration > 0 && (
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white/80 tabular-nums">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-xl ring-1 ring-white/[0.06]" />
                  </div>
                  <p className="text-[13px] font-medium text-white/90 truncate leading-tight">
                    {video.title}
                  </p>
                  <p className="text-[11px] text-white/35 truncate mt-0.5">
                    Music Video
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Related Artists */}
        {relatedArtists.length > 0 && (
          <section className="px-5 mb-8">
            <h2 className="text-[18px] font-semibold mb-4">Fans also like</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {relatedArtists.map((ra) => (
                <button
                  key={ra.id}
                  onClick={() => router.push(`/artist/${ra.id}`)}
                  className="flex-shrink-0 flex flex-col items-center gap-2.5 w-[100px] group"
                >
                  <div className="relative w-[100px] h-[100px] rounded-full overflow-hidden bg-white/[0.06]">
                    {ra.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={getHQThumbnail(ra.thumbnail)}
                        alt={ra.name}
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
                    {ra.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
