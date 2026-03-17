"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLibrary } from "@/hooks/useLibrary";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import SongCard from "@/components/SongCard";

type Tab = "liked" | "history" | "artists" | "playlists";

export default function Library() {
  const router = useRouter();
  const { likedSongs, history, playlists, followedArtists, createPlaylist, toggleFollow } = useLibrary();
  const { playSong } = useAudioPlayer();
  const [activeTab, setActiveTab] = useState<Tab>("liked");
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    createPlaylist(name);
    setNewPlaylistName("");
    setShowNewPlaylist(false);
  };

  return (
    <div className="animate-fadeIn px-5 pt-14">
      <h1 className="text-[28px] font-bold tracking-tight mb-6">Your Library</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-0.5">
        {([
          { key: "liked" as Tab, label: "Liked", count: likedSongs.length },
          { key: "history" as Tab, label: "History", count: history.length },
          { key: "artists" as Tab, label: "Artists", count: followedArtists.length },
          { key: "playlists" as Tab, label: "Playlists", count: playlists.length },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.key
                ? "bg-white text-black"
                : "bg-white/[0.07] text-white/60 hover:bg-white/[0.12]"
            }`}
          >
            {tab.label}{tab.count > 0 ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {/* Liked Songs */}
      {activeTab === "liked" && (
        <div className="animate-fadeIn">
          {likedSongs.length > 0 ? (
            <>
              <button
                onClick={() => {
                  if (likedSongs.length > 0) playSong(likedSongs[0], likedSongs);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/10 text-pink-300 text-[14px] font-medium hover:from-pink-500/30 hover:to-rose-500/30 active:scale-[0.98] transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                </svg>
                Play All
              </button>
              <div className="space-y-0.5">
                {likedSongs.map((song) => (
                  <SongCard key={song.id} song={song} queue={likedSongs} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-pink-400/30">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              }
              text="Songs you like will appear here"
              subtext="Tap the heart icon while playing a song"
            />
          )}
        </div>
      )}

      {/* History */}
      {activeTab === "history" && (
        <div className="animate-fadeIn">
          {history.length > 0 ? (
            <div className="space-y-0.5">
              {history.map((song, i) => (
                <SongCard key={`${song.id}-${i}`} song={song} queue={history} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-blue-400/30">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                </svg>
              }
              text="Your listening history will appear here"
              subtext="Start playing music to build your history"
            />
          )}
        </div>
      )}

      {/* Following Artists */}
      {activeTab === "artists" && (
        <div className="animate-fadeIn">
          {followedArtists.length > 0 ? (
            <div className="space-y-2">
              {followedArtists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => router.push(`/artist/${artist.id}`)}
                  className="w-full flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/[0.04] p-3.5 hover:bg-white/[0.06] active:scale-[0.98] transition-all text-left"
                >
                  {/* Artist avatar */}
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
                  {/* Artist info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold truncate">{artist.name}</h3>
                    {artist.subscribers && (
                      <p className="text-[12px] text-white/30 mt-0.5 truncate">
                        {artist.subscribers}
                      </p>
                    )}
                  </div>
                  {/* Unfollow button */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFollow(artist);
                    }}
                    className="px-3 py-1.5 rounded-full bg-white/[0.06] text-[11px] font-medium text-white/40 hover:bg-white/[0.1] hover:text-white/60 transition-all"
                  >
                    Following
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-white/20 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-violet-400/30">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                </svg>
              }
              text="Artists you follow will appear here"
              subtext="Follow artists from their profile page"
            />
          )}
        </div>
      )}

      {/* Playlists */}
      {activeTab === "playlists" && (
        <div className="animate-fadeIn">
          {/* New playlist button */}
          {showNewPlaylist ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreatePlaylist(); }}
              className="flex gap-2 mb-4"
            >
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name..."
                autoFocus
                className="flex-1 rounded-xl bg-white/[0.07] py-2.5 px-4 text-[14px] text-white placeholder-white/25 outline-none ring-1 ring-white/[0.04] focus:ring-white/[0.12] transition-all"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-white/[0.12] text-[13px] font-medium hover:bg-white/[0.18] transition-colors"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => { setShowNewPlaylist(false); setNewPlaylistName(""); }}
                className="px-3 py-2.5 rounded-xl text-white/40 hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewPlaylist(true)}
              className="w-full flex items-center gap-3 rounded-xl bg-white/[0.04] border border-dashed border-white/[0.08] p-4 mb-4 hover:bg-white/[0.06] active:scale-[0.98] transition-all text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-white/40">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="text-[14px] font-medium text-white/50">Create new playlist</span>
            </button>
          )}

          {/* Playlist list */}
          <div className="space-y-2">
            {playlists.map((playlist) => {
              const coverSongs = playlist.songs.slice(0, 4);
              return (
                <button
                  key={playlist.id}
                  onClick={() => router.push(`/library/playlist/${playlist.id}`)}
                  className="w-full flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/[0.04] p-3 hover:bg-white/[0.06] active:scale-[0.98] transition-all text-left"
                >
                  {/* Playlist thumbnail — mosaic or icon */}
                  <div className="relative h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden bg-white/[0.06]">
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
                        alt=""
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-violet-400/60">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-lg ring-1 ring-white/[0.08]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-semibold truncate">{playlist.name}</h3>
                    <p className="text-[12px] text-white/30 mt-0.5">
                      Playlist &middot; {playlist.songs.length} {playlist.songs.length === 1 ? "song" : "songs"}
                    </p>
                  </div>

                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-white/20 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              );
            })}
          </div>

          {playlists.length === 0 && !showNewPlaylist && (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-7 h-7 text-white/15">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                </svg>
              }
              text="Create your first playlist"
              subtext="Organize your favorite music"
            />
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, text, subtext }: { icon: React.ReactNode; text: string; subtext: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        {icon}
      </div>
      <p className="text-[14px] text-white/40">{text}</p>
      <p className="text-[12px] text-white/20">{subtext}</p>
    </div>
  );
}
