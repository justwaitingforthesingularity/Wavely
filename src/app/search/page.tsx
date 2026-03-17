"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchSongs, ArtistSearchResult, AlbumSearchResult, PlaylistSearchResult, VideoSearchResult } from "@/services/pipedApi";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Song } from "@/types/song";
import SongCard from "@/components/SongCard";

const INITIAL_SHOW = 3;

function CollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-white/30 uppercase tracking-wider font-medium">
          {title}
        </p>
        {count > INITIAL_SHOW && (
          <button
            onClick={onToggle}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.09] text-[11px] text-white/40 hover:text-white/60 transition-all duration-200"
          >
            {expanded ? "Show less" : `+${count - INITIAL_SHOW} more`}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export default function Search() {
  const router = useRouter();
  const { playSong } = useAudioPlayer();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([]);
  const [albumResults, setAlbumResults] = useState<AlbumSearchResult[]>([]);
  const [playlistResults, setPlaylistResults] = useState<PlaylistSearchResult[]>([]);
  const [videoResults, setVideoResults] = useState<VideoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Genre browse data — each has a representative artist for the thumbnail
  const genres = [
    { name: "Pop", slug: "pop", gradient: "from-pink-500 to-rose-600", artist: "Taylor Swift" },
    { name: "Hip-Hop", slug: "hip-hop", gradient: "from-orange-500 to-amber-600", artist: "Drake" },
    { name: "Rock", slug: "rock", gradient: "from-red-600 to-red-800", artist: "Foo Fighters" },
    { name: "R&B", slug: "r-and-b", gradient: "from-purple-500 to-violet-700", artist: "The Weeknd" },
    { name: "Electronic", slug: "electronic", gradient: "from-blue-500 to-cyan-600", artist: "Calvin Harris" },
    { name: "Jazz", slug: "jazz", gradient: "from-amber-600 to-yellow-800", artist: "Norah Jones" },
    { name: "Classical", slug: "classical", gradient: "from-teal-500 to-emerald-700", artist: "Ludovico Einaudi" },
    { name: "Lo-Fi", slug: "lo-fi", gradient: "from-indigo-500 to-purple-700", artist: "Nujabes" },
  ];
  const [genreThumbnails, setGenreThumbnails] = useState<Record<string, string>>(() => {
    // Load cached thumbnails instantly from localStorage
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("genre-thumbnails");
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          // Cache valid for 24 hours
          if (Date.now() - ts < 24 * 60 * 60 * 1000) return data;
        }
      } catch { /* ignore */ }
    }
    return {};
  });

  useEffect(() => {
    // Skip fetch if we already have cached thumbnails for all genres
    if (Object.keys(genreThumbnails).length >= genres.length) return;

    let cancelled = false;
    async function fetchGenreThumbnails() {
      const thumbnails: Record<string, string> = {};
      // Search for specific representative artists — fast & accurate
      await Promise.all(
        genres.map(async (genre) => {
          try {
            const data = await searchSongs(genre.artist);
            const match = (data.artists || [])[0];
            if (match?.thumbnail) {
              thumbnails[genre.slug] = match.thumbnail;
            }
          } catch {
            // ignore failures
          }
        })
      );
      if (!cancelled) {
        setGenreThumbnails(thumbnails);
        // Cache in localStorage for instant loads
        try {
          localStorage.setItem("genre-thumbnails", JSON.stringify({ data: thumbnails, ts: Date.now() }));
        } catch { /* quota exceeded, ignore */ }
      }
    }
    fetchGenreThumbnails();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expanded state for each section
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setArtistResults([]);
      setAlbumResults([]);
      setPlaylistResults([]);
      setVideoResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setExpandedSections({});

    try {
      const data = await searchSongs(searchQuery);

      const songs: Song[] = (data.items || [])
        .filter((item) => item.id)
        .map((item) => ({
          id: item.id,
          title: item.title || "Unknown",
          artist: item.artist || "Unknown Artist",
          artistRefs: item.artistIds?.map((a) => ({ id: a.id, name: a.name })),
          thumbnail: item.thumbnail || "",
          duration: item.duration || 0,
        }));

      setResults(songs);
      setArtistResults(data.artists || []);
      setAlbumResults(data.albums || []);
      setPlaylistResults(data.playlists || []);
      setVideoResults(data.videos || []);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
      setArtistResults([]);
      setAlbumResults([]);
      setPlaylistResults([]);
      setVideoResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    performSearch(query);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setArtistResults([]);
    setAlbumResults([]);
    setPlaylistResults([]);
    setVideoResults([]);
    setHasSearched(false);
  };

  const hasResults = artistResults.length > 0 || results.length > 0 || albumResults.length > 0 || playlistResults.length > 0 || videoResults.length > 0;

  const visibleArtists = expandedSections.artists ? artistResults : artistResults.slice(0, INITIAL_SHOW);
  const visibleSongs = expandedSections.songs ? results : results.slice(0, INITIAL_SHOW);
  const visibleAlbums = expandedSections.albums ? albumResults : albumResults.slice(0, INITIAL_SHOW);
  const visiblePlaylists = expandedSections.playlists ? playlistResults : playlistResults.slice(0, INITIAL_SHOW);
  const visibleVideos = expandedSections.videos ? videoResults : videoResults.slice(0, INITIAL_SHOW);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleVideoClick = (video: VideoSearchResult) => {
    const song: Song = {
      id: video.songId, // Use the song ID for audio playback
      title: video.title,
      artist: video.artist,
      thumbnail: video.thumbnail,
      duration: video.duration,
      musicVideoId: video.id, // Use the video ID for the video embed
    };
    const queue = videoResults.map((v) => ({
      id: v.songId,
      title: v.title,
      artist: v.artist,
      thumbnail: v.thumbnail,
      duration: v.duration,
      musicVideoId: v.id,
    }));
    playSong(song, queue);
  };

  return (
    <div className="animate-fadeIn px-5 pt-14">
      <h1 className="text-[28px] font-bold tracking-tight mb-5">Search</h1>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/30"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Songs, artists, albums..."
            className="w-full rounded-xl bg-white/[0.07] py-3 pl-11 pr-4 text-[15px] text-white placeholder-white/25 outline-none ring-1 ring-white/[0.04] focus:ring-white/[0.12] focus:bg-white/[0.09] transition-all duration-300"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-white/60">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Loading state */}
      {isSearching && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
          <p className="text-[13px] text-white/30">Searching...</p>
        </div>
      )}

      {/* Results */}
      {!isSearching && hasSearched && hasResults && (
        <div className="animate-fadeIn">
          {/* Artist results */}
          {artistResults.length > 0 && (
            <CollapsibleSection
              title="Artists"
              count={artistResults.length}
              expanded={!!expandedSections.artists}
              onToggle={() => toggleSection("artists")}
            >
              <div className="space-y-1.5">
                {visibleArtists.map((artist) => (
                  <button
                    key={artist.id}
                    onClick={() => router.push(`/artist/${artist.id}`)}
                    className="flex w-full items-center gap-3.5 rounded-xl p-2.5 text-left transition-all duration-200 hover:bg-white/[0.04] active:scale-[0.98]"
                  >
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                      {artist.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={artist.thumbnail}
                          alt={artist.name}
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/20">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-full ring-1 ring-white/[0.08]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold truncate">{artist.name}</p>
                      <p className="text-[12px] text-white/35 truncate mt-0.5">
                        Artist {artist.subscribers ? `\u00B7 ${artist.subscribers}` : ""}
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-white/20 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Song results */}
          {results.length > 0 && (
            <CollapsibleSection
              title="Songs"
              count={results.length}
              expanded={!!expandedSections.songs}
              onToggle={() => toggleSection("songs")}
            >
              <div className="space-y-0.5">
                {visibleSongs.map((song) => (
                  <SongCard key={song.id} song={song} queue={results} />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Music Video results */}
          {videoResults.length > 0 && (
            <CollapsibleSection
              title="Music Videos"
              count={videoResults.length}
              expanded={!!expandedSections.videos}
              onToggle={() => toggleSection("videos")}
            >
              <div className="space-y-1.5">
                {visibleVideos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => handleVideoClick(video)}
                    className="flex w-full items-center gap-3.5 rounded-xl p-2.5 text-left transition-all duration-200 hover:bg-white/[0.04] active:scale-[0.98]"
                  >
                    {/* Video thumbnail (16:9) */}
                    <div className="relative h-14 w-[100px] flex-shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                      {video.thumbnail ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-500/20 to-orange-500/20">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/20">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {/* Play icon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white ml-0.5">
                            <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="absolute inset-0 rounded-lg ring-1 ring-white/[0.08]" />
                    </div>
                    {/* Video info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate">{video.title}</p>
                      <p className="text-[12px] text-white/35 truncate mt-0.5">
                        Music Video{video.artist ? ` \u00B7 ${video.artist}` : ""}{video.duration > 0 ? ` \u00B7 ${formatDuration(video.duration)}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Album / EP / Single results */}
          {albumResults.length > 0 && (
            <CollapsibleSection
              title="Releases"
              count={albumResults.length}
              expanded={!!expandedSections.albums}
              onToggle={() => toggleSection("albums")}
            >
              <div className="space-y-1.5">
                {visibleAlbums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => router.push(`/album/${album.id}`)}
                    className="flex w-full items-center gap-3.5 rounded-xl p-2.5 text-left transition-all duration-200 hover:bg-white/[0.04] active:scale-[0.98]"
                  >
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
                      {album.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={album.thumbnail}
                          alt={album.title}
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/20">
                            <path fillRule="evenodd" d="m19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.403-4.909l2.311-.66a1.5 1.5 0 0 0 1.088-1.442V6.994l-9 2.572v9.737a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.402-4.909l2.31-.66a1.5 1.5 0 0 0 1.088-1.442V5.25a.75.75 0 0 1 .544-.721l10.5-3a.75.75 0 0 1 .658.122Z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-xl ring-1 ring-white/[0.08]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate">{album.title}</p>
                      <p className="text-[12px] text-white/35 truncate mt-0.5">
                        {album.type || "Release"}{album.artist ? ` \u00B7 ${album.artist}` : ""}{album.year ? ` \u00B7 ${album.year}` : ""}
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-white/20 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Playlist results */}
          {playlistResults.length > 0 && (
            <CollapsibleSection
              title="Playlists"
              count={playlistResults.length}
              expanded={!!expandedSections.playlists}
              onToggle={() => toggleSection("playlists")}
            >
              <div className="space-y-1.5">
                {visiblePlaylists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => router.push(`/playlist/${pl.id}`)}
                    className="flex w-full items-center gap-3.5 rounded-xl p-2.5 text-left transition-all duration-200 hover:bg-white/[0.04] active:scale-[0.98]"
                  >
                    {/* Playlist thumbnail */}
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
                      {pl.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={pl.thumbnail}
                          alt={pl.title}
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white/20">
                            <path fillRule="evenodd" d="m19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.403-4.909l2.311-.66a1.5 1.5 0 0 0 1.088-1.442V6.994l-9 2.572v9.737a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.402-4.909l2.31-.66a1.5 1.5 0 0 0 1.088-1.442V5.25a.75.75 0 0 1 .544-.721l10.5-3a.75.75 0 0 1 .658.122Z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-xl ring-1 ring-white/[0.08]" />
                    </div>
                    {/* Playlist info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate">{pl.title}</p>
                      <p className="text-[12px] text-white/35 truncate mt-0.5">
                        Playlist {pl.author ? `\u00B7 ${pl.author}` : ""} {pl.songCount ? `\u00B7 ${pl.songCount}` : ""}
                      </p>
                    </div>
                    {/* Chevron */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-white/20 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* No results */}
      {!isSearching && hasSearched && !hasResults && (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-[15px] text-white/50">No results found</p>
          <p className="text-[13px] text-white/25">Try a different search term</p>
        </div>
      )}

      {/* Browse categories — shown when not searching */}
      {!hasSearched && (
        <section className="animate-fadeIn">
          <h2 className="text-[13px] text-white/30 uppercase tracking-wider font-semibold mb-4">
            Browse
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {genres.map((genre) => (
              <button
                key={genre.name}
                onClick={() => router.push(`/genre/${genre.slug}`)}
                className={`relative bg-gradient-to-br ${genre.gradient} rounded-2xl p-4 h-[88px] overflow-hidden cursor-pointer hover:opacity-90 active:scale-[0.97] transition-all duration-200`}
              >
                <span className="absolute bottom-4 left-4 font-semibold text-[15px] text-white drop-shadow-sm z-10">
                  {genre.name}
                </span>
                {genreThumbnails[genre.slug] && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={genreThumbnails[genre.slug]}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute bottom-1 right-1 w-[60px] h-[60px] rounded-lg object-cover rotate-[15deg] shadow-lg shadow-black/30"
                    loading="lazy"
                  />
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
