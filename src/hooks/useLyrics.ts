"use client";

import { useState, useEffect, useCallback } from "react";

export interface LyricLine {
  time: number;
  text: string;
}

function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/;

  for (const line of lrc.split("\n")) {
    const match = line.match(regex);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, "0"));
      const time = minutes * 60 + seconds + ms / 1000;
      const text = match[4].trim();
      if (text) {
        lines.push({ time, text });
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

export function useLyrics(title: string, artist: string, duration: number) {
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchLyrics = useCallback(async () => {
    if (!title) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    setLyrics(null);
    setPlainLyrics(null);

    try {
      const params = new URLSearchParams({ title, artist });
      if (duration > 0) {
        params.set("duration", String(Math.round(duration)));
      }

      const res = await fetch(`/api/lyrics?${params.toString()}`);
      const data = await res.json();

      if (data.found && data.syncedLyrics) {
        const parsed = parseLRC(data.syncedLyrics);
        if (parsed.length > 0) {
          setLyrics(parsed);
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics);
        } else {
          setError(true);
        }
      } else if (data.found && data.plainLyrics) {
        setPlainLyrics(data.plainLyrics);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [title, artist, duration]);

  useEffect(() => {
    fetchLyrics();
  }, [fetchLyrics]);

  return { lyrics, plainLyrics, loading, error };
}
