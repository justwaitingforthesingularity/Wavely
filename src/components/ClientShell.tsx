"use client";

import { AudioPlayerProvider } from "@/hooks/useAudioPlayer";
import { LibraryProvider, useLibrary } from "@/hooks/useLibrary";
import { EqualizerProvider, useEqualizer } from "@/hooks/useEqualizer";
import BottomNav from "./BottomNav";
import MiniPlayer from "./MiniPlayer";
import PlayerView from "./PlayerView";

function AppContent({ children }: { children: React.ReactNode }) {
  const { addToHistory } = useLibrary();
  const { connectAudio } = useEqualizer();

  return (
    <AudioPlayerProvider onSongPlay={addToHistory} onAudioElement={connectAudio}>
      {/* Scrollable content area — only this part scrolls */}
      <div className="phone-scroll">
        <div className="dynamic-bg" />
        <main className="relative z-10 min-h-screen pb-40">
          {children}
        </main>
      </div>
      {/* Overlays — stay fixed on top, never scroll */}
      <MiniPlayer />
      <BottomNav />
      <PlayerView />
    </AudioPlayerProvider>
  );
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <LibraryProvider>
      <EqualizerProvider>
        {/* Phone frame: on wide screens, constrains to 9:16 with ambient glow */}
        <div className="phone-backdrop">
          <div className="phone-frame">
            <AppContent>{children}</AppContent>
          </div>
        </div>
      </EqualizerProvider>
    </LibraryProvider>
  );
}
