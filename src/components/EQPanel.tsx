"use client";

import { useState } from "react";
import { useEqualizer } from "@/hooks/useEqualizer";

export default function EQPanel({ onClose }: { onClose: () => void }) {
  const {
    bands, enabled, activePreset,
    setBandGain, applyPreset, toggleEQ,
    getAllPresets, saveCustomPreset, deleteCustomPreset, renameCustomPreset,
  } = useEqualizer();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [renamingPreset, setRenamingPreset] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const allPresets = getAllPresets();

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    saveCustomPreset(name);
    setSaveName("");
    setShowSaveDialog(false);
  };

  const handleRename = (oldName: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setRenamingPreset(null);
      return;
    }
    renameCustomPreset(oldName, newName);
    setRenamingPreset(null);
    setRenameValue("");
  };

  return (
    <div className="fixed inset-0 z-[110] animate-fadeIn" style={{ touchAction: "none" }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-[#1a1a20] border-t border-white/[0.08] animate-slideUp">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <h2 className="text-[18px] font-bold">Equalizer</h2>
          <button
            onClick={toggleEQ}
            className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
              enabled
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-white/[0.06] text-white/40 border border-white/[0.06]"
            }`}
          >
            {enabled ? "ON" : "OFF"}
          </button>
        </div>

        {/* Preset selector dropdown */}
        <div className="px-6 pb-4">
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-white/40">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                </svg>
                <span className="text-[14px] font-medium text-white/80">{activePreset}</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-white/30 transition-transform ${showDropdown ? "rotate-180" : ""}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Dropdown list */}
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-[240px] overflow-y-auto rounded-xl bg-[#252530] border border-white/[0.08] shadow-xl">
                  {allPresets.map((preset) => (
                    <div
                      key={preset.name}
                      className="flex items-center group"
                    >
                      {renamingPreset === preset.name ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); handleRename(preset.name); }}
                          className="flex-1 flex items-center gap-2 px-4 py-2.5"
                        >
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            autoFocus
                            className="flex-1 bg-white/[0.08] rounded-lg px-2 py-1 text-[13px] text-white outline-none"
                            onBlur={() => handleRename(preset.name)}
                          />
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              applyPreset(preset);
                              setShowDropdown(false);
                            }}
                            className={`flex-1 text-left px-4 py-2.5 text-[13px] transition-colors ${
                              activePreset === preset.name
                                ? "text-green-400 font-medium"
                                : "text-white/70 hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {activePreset === preset.name && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                  <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                </svg>
                              )}
                              {preset.name}
                              {preset.isCustom && (
                                <span className="text-[10px] text-white/20 ml-1">custom</span>
                              )}
                            </div>
                          </button>
                          {preset.isCustom && (
                            <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingPreset(preset.name);
                                  setRenameValue(preset.name);
                                }}
                                className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors"
                                title="Rename"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5 text-white/40">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCustomPreset(preset.name);
                                }}
                                className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                                title="Delete"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5 text-white/40 hover:text-red-400">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Band sliders */}
        <div className="px-6 pb-5">
          <div className="flex items-end justify-between gap-1">
            {bands.map((band, i) => (
              <div key={band.frequency} className="flex flex-col items-center gap-2 flex-1">
                <span className={`text-[10px] tabular-nums ${enabled ? "text-white/50" : "text-white/20"}`}>
                  {band.gain > 0 ? "+" : ""}{band.gain.toFixed(0)}
                </span>

                <div className="relative h-32 w-6 flex items-center justify-center">
                  <div className="absolute w-1 h-full bg-white/[0.08] rounded-full" />
                  <div className="absolute w-3 h-[1px] bg-white/20 top-1/2" />
                  <div
                    className="absolute w-1 rounded-full transition-all"
                    style={{
                      background: enabled ? "rgba(74, 222, 128, 0.7)" : "rgba(255,255,255,0.15)",
                      height: `${Math.abs(band.gain) / 12 * 50}%`,
                      bottom: band.gain >= 0 ? "50%" : undefined,
                      top: band.gain < 0 ? "50%" : undefined,
                    }}
                  />
                  <div
                    className="absolute w-4 h-4 rounded-full border-2 transition-all"
                    style={{
                      background: enabled ? "#4ade80" : "#666",
                      borderColor: enabled ? "#22c55e" : "#555",
                      top: `${50 - (band.gain / 12) * 50}%`,
                      transform: "translateY(-50%)",
                    }}
                  />
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={band.gain}
                    onChange={(e) => setBandGain(i, Number(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer"
                    style={{
                      writingMode: "vertical-lr" as const,
                      direction: "rtl",
                    }}
                  />
                </div>

                <span className="text-[9px] text-white/30 font-medium">{band.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Save custom preset */}
        <div className="px-6 pb-6">
          {showSaveDialog ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSave(); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Preset name..."
                autoFocus
                className="flex-1 rounded-xl bg-white/[0.07] py-2.5 px-4 text-[13px] text-white placeholder-white/25 outline-none ring-1 ring-white/[0.04] focus:ring-white/[0.12] transition-all"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-green-500/20 text-green-400 text-[12px] font-medium hover:bg-green-500/30 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setShowSaveDialog(false); setSaveName(""); }}
                className="px-3 py-2.5 rounded-xl text-white/40 text-[12px] hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-dashed border-white/[0.08] text-[12px] text-white/40 hover:bg-white/[0.06] hover:text-white/60 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Save as custom preset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
