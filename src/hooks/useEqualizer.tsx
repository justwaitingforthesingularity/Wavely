"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";

export interface EQBand {
  frequency: number;
  gain: number;
  label: string;
}

const DEFAULT_BANDS: EQBand[] = [
  { frequency: 60, gain: 0, label: "60" },
  { frequency: 170, gain: 0, label: "170" },
  { frequency: 400, gain: 0, label: "400" },
  { frequency: 1000, gain: 0, label: "1K" },
  { frequency: 2500, gain: 0, label: "2.5K" },
  { frequency: 6000, gain: 0, label: "6K" },
  { frequency: 12000, gain: 0, label: "12K" },
];

export interface EQPreset {
  name: string;
  gains: number[];
  isCustom?: boolean;
}

export const BUILT_IN_PRESETS: EQPreset[] = [
  { name: "Flat", gains: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Bass Boost", gains: [6, 4, 2, 0, 0, 0, 0] },
  { name: "Treble Boost", gains: [0, 0, 0, 0, 2, 4, 6] },
  { name: "Vocal", gains: [-2, 0, 2, 4, 2, 0, -2] },
  { name: "Rock", gains: [4, 2, -1, 0, 1, 3, 4] },
  { name: "Pop", gains: [-1, 2, 4, 2, -1, -1, 0] },
  { name: "Jazz", gains: [3, 1, 0, 1, 2, 3, 4] },
  { name: "Electronic", gains: [4, 3, 0, -1, 0, 3, 5] },
  { name: "Night Mode", gains: [-3, -1, 0, 2, 0, -2, -4] },
];

interface EqualizerState {
  bands: EQBand[];
  enabled: boolean;
  activePreset: string;
  customPresets: EQPreset[];
}

interface EqualizerActions {
  setBandGain: (index: number, gain: number) => void;
  applyPreset: (preset: EQPreset) => void;
  toggleEQ: () => void;
  connectAudio: (audioElement: HTMLAudioElement) => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (name: string) => void;
  renameCustomPreset: (oldName: string, newName: string) => void;
  getAllPresets: () => EQPreset[];
}

const EqualizerContext = createContext<(EqualizerState & EqualizerActions) | null>(null);

const STORAGE_KEY = "wavely_eq_settings";

export function EqualizerProvider({ children }: { children: React.ReactNode }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const pendingElementRef = useRef<HTMLAudioElement | null>(null);
  const isConnectedRef = useRef(false);

  const [state, setState] = useState<EqualizerState>(() => ({
    bands: DEFAULT_BANDS.map((b) => ({ ...b })),
    enabled: false,
    activePreset: "Flat",
    customPresets: [],
  }));

  // Load saved settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({
          ...prev,
          bands: parsed.bands || prev.bands,
          enabled: false,
          activePreset: parsed.activePreset || "Flat",
          customPresets: (parsed.customPresets || []).map((p: EQPreset) => ({ ...p, isCustom: true })),
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save settings on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        bands: state.bands,
        enabled: state.enabled,
        activePreset: state.activePreset,
        customPresets: state.customPresets,
      }));
    } catch {
      // ignore
    }
  }, [state]);

  // Apply gains to filters
  useEffect(() => {
    filtersRef.current.forEach((filter, i) => {
      filter.gain.value = state.enabled ? state.bands[i].gain : 0;
    });
  }, [state.bands, state.enabled]);

  const ensureConnected = useCallback(() => {
    if (isConnectedRef.current) return;
    const audioElement = pendingElementRef.current;
    if (!audioElement) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();

      sourceRef.current = ctx.createMediaElementSource(audioElement);

      filtersRef.current = DEFAULT_BANDS.map((band, i) => {
        const filter = ctx.createBiquadFilter();
        if (i === 0) filter.type = "lowshelf";
        else if (i === DEFAULT_BANDS.length - 1) filter.type = "highshelf";
        else filter.type = "peaking";
        filter.frequency.value = band.frequency;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        return filter;
      });

      let lastNode: AudioNode = sourceRef.current;
      for (const filter of filtersRef.current) {
        lastNode.connect(filter);
        lastNode = filter;
      }
      lastNode.connect(ctx.destination);
      isConnectedRef.current = true;
    } catch (e) {
      console.error("EQ setup failed:", e);
    }
  }, []);

  const connectAudio = useCallback((audioElement: HTMLAudioElement) => {
    pendingElementRef.current = audioElement;
  }, []);

  const setBandGain = useCallback((index: number, gain: number) => {
    setState((prev) => {
      const newBands = [...prev.bands];
      newBands[index] = { ...newBands[index], gain };
      // If a custom preset is active, update it in place
      const isCustomActive = prev.customPresets.some((p) => p.name === prev.activePreset);
      let updatedCustom = prev.customPresets;
      let presetName = prev.activePreset;
      if (isCustomActive) {
        updatedCustom = prev.customPresets.map((p) =>
          p.name === prev.activePreset ? { ...p, gains: newBands.map((b) => b.gain) } : p
        );
      } else {
        presetName = "Custom";
      }
      return { ...prev, bands: newBands, activePreset: presetName, customPresets: updatedCustom };
    });
  }, []);

  const applyPreset = useCallback((preset: EQPreset) => {
    setState((prev) => ({
      ...prev,
      bands: prev.bands.map((band, i) => ({ ...band, gain: preset.gains[i] })),
      activePreset: preset.name,
    }));
  }, []);

  const toggleEQ = useCallback(() => {
    ensureConnected();
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
    setState((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, [ensureConnected]);

  const saveCustomPreset = useCallback((name: string) => {
    setState((prev) => {
      const gains = prev.bands.map((b) => b.gain);
      const existing = prev.customPresets.findIndex((p) => p.name === name);
      let newCustom: EQPreset[];
      if (existing >= 0) {
        newCustom = prev.customPresets.map((p, i) =>
          i === existing ? { name, gains, isCustom: true } : p
        );
      } else {
        newCustom = [...prev.customPresets, { name, gains, isCustom: true }];
      }
      return { ...prev, customPresets: newCustom, activePreset: name };
    });
  }, []);

  const deleteCustomPreset = useCallback((name: string) => {
    setState((prev) => ({
      ...prev,
      customPresets: prev.customPresets.filter((p) => p.name !== name),
      activePreset: prev.activePreset === name ? "Flat" : prev.activePreset,
      bands: prev.activePreset === name
        ? DEFAULT_BANDS.map((b) => ({ ...b }))
        : prev.bands,
    }));
  }, []);

  const renameCustomPreset = useCallback((oldName: string, newName: string) => {
    setState((prev) => ({
      ...prev,
      customPresets: prev.customPresets.map((p) =>
        p.name === oldName ? { ...p, name: newName } : p
      ),
      activePreset: prev.activePreset === oldName ? newName : prev.activePreset,
    }));
  }, []);

  const getAllPresets = useCallback((): EQPreset[] => {
    return [...BUILT_IN_PRESETS, ...state.customPresets];
  }, [state.customPresets]);

  return (
    <EqualizerContext.Provider
      value={{
        ...state,
        setBandGain,
        applyPreset,
        toggleEQ,
        connectAudio,
        saveCustomPreset,
        deleteCustomPreset,
        renameCustomPreset,
        getAllPresets,
      }}
    >
      {children}
    </EqualizerContext.Provider>
  );
}

export function useEqualizer() {
  const context = useContext(EqualizerContext);
  if (!context) {
    throw new Error("useEqualizer must be used within EqualizerProvider");
  }
  return context;
}
