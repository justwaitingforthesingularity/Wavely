"use client";

import { useState, useEffect, useRef } from "react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useLyrics } from "@/hooks/useLyrics";

export default function LyricsPanel({ onClose, overrideTime }: { onClose: () => void; overrideTime?: number }) {
  const { currentSong, currentTime: audioTime, duration, seek } = useAudioPlayer();
  const baseTime = overrideTime ?? audioTime;
  const [offset, setOffset] = useState(0);
  const currentTime = baseTime + offset;

  const { lyrics, plainLyrics, loading, error } = useLyrics(
    currentSong?.title || "",
    currentSong?.artist || "",
    duration
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLButtonElement>(null);
  const lastScrolledLine = useRef(-1);

  // Reset scroll tracking when lyrics change
  useEffect(() => {
    lastScrolledLine.current = -1;
  }, [lyrics]);

  // Find current active line
  const activeLine = lyrics
    ? lyrics.reduce((acc, line, i) => (line.time <= currentTime ? i : acc), -1)
    : -1;

  // Auto-scroll to active line — use getBoundingClientRect for reliable positioning
  useEffect(() => {
    if (activeLine >= 0 && activeLine !== lastScrolledLine.current && activeLineRef.current && containerRef.current) {
      lastScrolledLine.current = activeLine;
      const container = containerRef.current;
      const element = activeLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
      const containerHeight = container.clientHeight;
      // Position active line about 40% down so it's clearly visible
      const targetScroll = relativeTop - containerHeight * 0.4;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, [activeLine]);

  return (
    <div className="fixed inset-0 z-[110] animate-fadeIn">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-14 pb-2">
          <h3 className="text-[16px] font-semibold text-white/80">Lyrics</h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-white/10 active:scale-90 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-white/60">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Song info */}
        {currentSong && (
          <div className="px-6 pb-2">
            <p className="text-[14px] font-medium text-white/60 truncate">{currentSong.title}</p>
            <p className="text-[12px] text-white/30 truncate">{currentSong.artist}</p>
          </div>
        )}

        {/* Timing offset slider */}
        {lyrics && (
          <div className="px-6 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30 font-medium flex-shrink-0">-5s</span>
              <div className="flex-1 relative h-6 flex items-center">
                <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/30 rounded-full transition-[width] duration-100"
                    style={{ width: `${((offset + 5) / 10) * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.1}
                  value={offset}
                  onChange={(e) => setOffset(Math.round(Number(e.target.value) * 10) / 10)}
                  className="absolute w-full opacity-0 h-6 cursor-pointer"
                />
              </div>
              <span className="text-[10px] text-white/30 font-medium flex-shrink-0">+5s</span>
              <span className="text-[11px] text-white/40 tabular-nums min-w-[42px] text-center font-medium flex-shrink-0">
                {offset === 0 ? "sync" : `${offset > 0 ? "+" : ""}${offset.toFixed(1)}s`}
              </span>
              {offset !== 0 && (
                <button
                  onClick={() => setOffset(0)}
                  className="text-[10px] text-white/30 hover:text-white/50 transition-colors flex-shrink-0"
                >
                  reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lyrics content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-6 pb-40 scrollbar-hide"
        >
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
              <p className="text-[13px] text-white/30">Finding lyrics...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white/15">
                <path fillRule="evenodd" d="m19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.403-4.909l2.311-.66a1.5 1.5 0 0 0 1.088-1.442V6.994l-9 2.572v9.737a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.402-4.909l2.31-.66a1.5 1.5 0 0 0 1.088-1.442V5.25a.75.75 0 0 1 .544-.721l10.5-3a.75.75 0 0 1 .658.122Z" clipRule="evenodd" />
              </svg>
              <p className="text-[14px] text-white/40">No lyrics found</p>
              <p className="text-[12px] text-white/20">Lyrics aren&apos;t available for this song</p>
            </div>
          )}

          {/* Synced lyrics */}
          {lyrics && !loading && (
            <div className="space-y-4 py-8">
              {lyrics.map((line, i) => (
                <button
                  key={i}
                  ref={i === activeLine ? activeLineRef : null}
                  onClick={() => seek(line.time)}
                  className={`block w-full text-left transition-all duration-300 ${
                    i === activeLine
                      ? "text-white text-[22px] font-bold scale-100 opacity-100"
                      : i < activeLine
                        ? "text-white/20 text-[18px] font-semibold"
                        : "text-white/30 text-[18px] font-semibold"
                  }`}
                >
                  {line.text}
                </button>
              ))}
            </div>
          )}

          {/* Plain lyrics (unsynced) */}
          {plainLyrics && !lyrics && !loading && (
            <div className="py-8">
              {plainLyrics.split("\n").map((line, i) => (
                <p
                  key={i}
                  className={`text-[16px] leading-relaxed ${
                    line.trim() ? "text-white/50 font-medium" : "h-4"
                  }`}
                >
                  {line || "\u00A0"}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
