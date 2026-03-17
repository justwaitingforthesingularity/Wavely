"use client";

import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useLibrary } from "@/hooks/useLibrary";
import SongCard from "@/components/SongCard";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { playSong } = useAudioPlayer();
  const { history, likedSongs } = useLibrary();

  const recentSongs = history.slice(0, 6);

  return (
    <div className="animate-fadeIn px-5 pt-14">
      <h1 className="text-[28px] font-bold tracking-tight mb-1">{getGreeting()}</h1>
      <p className="text-[14px] text-white/35 mb-8">What would you like to listen to?</p>

      {/* Quick picks / moods */}
      <section className="mb-10">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { name: "Chill Vibes", emoji: "\u{1F30A}", gradient: "from-cyan-600/30 to-blue-800/20" },
            { name: "Workout", emoji: "\u{1F525}", gradient: "from-orange-600/30 to-red-800/20" },
            { name: "Focus", emoji: "\u{1F3AF}", gradient: "from-violet-600/30 to-indigo-800/20" },
            { name: "Party", emoji: "\u2728", gradient: "from-pink-600/30 to-rose-800/20" },
            { name: "Acoustic", emoji: "\u{1F3B8}", gradient: "from-amber-600/30 to-yellow-800/20" },
            { name: "Sleep", emoji: "\u{1F319}", gradient: "from-slate-600/30 to-zinc-800/20" },
          ].map((mood) => (
            <div
              key={mood.name}
              className={`flex items-center gap-3 rounded-xl bg-gradient-to-r ${mood.gradient} p-3.5 border border-white/[0.04] hover:border-white/[0.08] active:scale-[0.97] transition-all duration-200 cursor-pointer`}
            >
              <span className="text-xl">{mood.emoji}</span>
              <span className="font-medium text-[13px] text-white/80">{mood.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recently played */}
      {recentSongs.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-semibold">Recently Played</h2>
            {history.length > 6 && (
              <a href="/library" className="text-[12px] text-white/30 hover:text-white/50 transition-colors">
                See all
              </a>
            )}
          </div>
          <div className="space-y-0.5">
            {recentSongs.map((song, i) => (
              <SongCard key={`${song.id}-${i}`} song={song} queue={history} />
            ))}
          </div>
        </section>
      )}

      {/* Liked songs quick access */}
      {likedSongs.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-semibold">Liked Songs</h2>
            <a href="/library" className="text-[12px] text-white/30 hover:text-white/50 transition-colors">
              See all
            </a>
          </div>
          <button
            onClick={() => playSong(likedSongs[0], likedSongs)}
            className="w-full flex items-center gap-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/[0.08] p-4 hover:from-pink-500/15 hover:to-rose-500/15 active:scale-[0.98] transition-all text-left"
          >
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold">Liked Songs</h3>
              <p className="text-[12px] text-white/30 mt-0.5">{likedSongs.length} songs</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-pink-400">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
            </svg>
          </button>
        </section>
      )}

      {/* Empty state when no history */}
      {recentSongs.length === 0 && likedSongs.length === 0 && (
        <section className="mb-10">
          <h2 className="text-[18px] font-semibold mb-4">Recently Played</h2>
          <p className="text-[13px] text-white/20">
            Search for music to start listening
          </p>
        </section>
      )}
    </div>
  );
}
