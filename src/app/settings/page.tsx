"use client";

import { useState, useEffect, useCallback } from "react";
import { useLibrary } from "@/hooks/useLibrary";
import { useEqualizer, BUILT_IN_PRESETS } from "@/hooks/useEqualizer";

// ─── Profile Types & Storage ───────────────────────────────────────

interface UserProfile {
  id: string;
  name: string;
  avatar: string; // emoji or initials
  color: string; // accent color
  createdAt: number;
}

const PROFILE_STORAGE_KEY = "wavely_profiles";
const ACTIVE_PROFILE_KEY = "wavely_active_profile";
const SETTINGS_STORAGE_KEY = "wavely_settings";

const AVATAR_OPTIONS = ["🎵", "🎧", "🎤", "🎸", "🎹", "🎷", "🎺", "🥁", "🎻", "🪗", "🎶", "🎼", "🌊", "⚡", "🔥", "💜", "🖤", "💚", "🤍", "👤"];
const COLOR_OPTIONS = [
  "#1ed760", "#1db954", "#e91e63", "#9c27b0", "#673ab7",
  "#3f51b5", "#2196f3", "#00bcd4", "#009688", "#ff5722",
  "#ff9800", "#ffc107", "#8bc34a", "#607d8b", "#ffffff",
];

interface AppSettings {
  audioQuality: "low" | "normal" | "high";
  crossfadeDuration: number; // 0 = off, 1-12 seconds
  gaplessPlayback: boolean;
  dynamicColors: boolean;
  lyricsOffset: number; // -10 to +10 seconds
  autoPlay: boolean;
  showMusicVideos: boolean;
  normalizeVolume: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  audioQuality: "high",
  crossfadeDuration: 0,
  gaplessPlayback: true,
  dynamicColors: true,
  lyricsOffset: 0,
  autoPlay: true,
  showMusicVideos: true,
  normalizeVolume: false,
};

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

function loadProfiles(): UserProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveProfiles(profiles: UserProfile[]) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  } catch {}
}

function getActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

function setActiveProfileId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch {}
}

// ─── Main Settings Page ────────────────────────────────────────────

export default function Settings() {
  const { likedSongs, history, playlists, followedArtists } = useLibrary();
  const { enabled: eqEnabled, activePreset, toggleEQ, applyPreset, getAllPresets } = useEqualizer();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [showEQPresets, setShowEQPresets] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [cacheSize, setCacheSize] = useState("0 MB");

  // Load settings and profiles from localStorage
  useEffect(() => {
    setSettings(loadSettings());
    const profs = loadProfiles();
    setProfiles(profs);
    const activeId = getActiveProfileId();
    if (activeId) {
      setActiveProfile(profs.find((p) => p.id === activeId) || null);
    }
    // Estimate cache size
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("wavely_")) {
          total += (localStorage.getItem(key) || "").length * 2; // UTF-16
        }
      }
      if (total < 1024) setCacheSize(`${total} B`);
      else if (total < 1024 * 1024) setCacheSize(`${(total / 1024).toFixed(1)} KB`);
      else setCacheSize(`${(total / (1024 * 1024)).toFixed(1)} MB`);
    } catch {}
  }, []);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const clearCache = useCallback(() => {
    try {
      const keysToKeep = [PROFILE_STORAGE_KEY, ACTIVE_PROFILE_KEY, SETTINGS_STORAGE_KEY, "wavely_liked_songs", "wavely_playlists", "wavely_followed_artists"];
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("wavely_") && !keysToKeep.includes(key)) {
          toRemove.push(key);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      setCacheSize("0 B");
    } catch {}
  }, []);

  // ─── Profile Management ────────────────────────────────────────

  const saveProfile = useCallback((profile: UserProfile) => {
    setProfiles((prev) => {
      const exists = prev.findIndex((p) => p.id === profile.id);
      let next: UserProfile[];
      if (exists >= 0) {
        next = prev.map((p) => (p.id === profile.id ? profile : p));
      } else {
        next = [...prev, profile];
      }
      saveProfiles(next);
      return next;
    });
    setActiveProfile(profile);
    setActiveProfileId(profile.id);
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveProfiles(next);
      return next;
    });
    if (activeProfile?.id === id) {
      setActiveProfile(null);
      setActiveProfileId(null);
    }
  }, [activeProfile]);

  const switchProfile = useCallback((profile: UserProfile) => {
    setActiveProfile(profile);
    setActiveProfileId(profile.id);
  }, []);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="animate-fadeIn px-5 pt-14 pb-40">
      <h1 className="text-[28px] font-bold tracking-tight mb-6">Settings</h1>

      <div className="space-y-8">
        {/* ─── Profile Section ─── */}
        <SettingSection title="Profile">
          {/* Active profile or prompt to create */}
          {activeProfile ? (
            <div className="px-4 py-4">
              <div className="flex items-center gap-3.5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-[22px] flex-shrink-0"
                  style={{ backgroundColor: activeProfile.color + "25", border: `2px solid ${activeProfile.color}` }}
                >
                  {activeProfile.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold text-white truncate">{activeProfile.name}</p>
                  <p className="text-[12px] text-white/30 mt-0.5">
                    {likedSongs.length} liked · {playlists.length} playlists · {followedArtists.length} following
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingProfile(activeProfile);
                    setShowProfileEditor(true);
                  }}
                  className="p-2 rounded-full hover:bg-white/[0.08] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4.5 h-4.5 text-white/40">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingProfile(null);
                setShowProfileEditor(true);
              }}
              className="w-full px-4 py-4 flex items-center gap-3.5 hover:bg-white/[0.03] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-white/40">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[14px] font-medium text-white/80">Create Profile</p>
                <p className="text-[12px] text-white/30 mt-0.5">Personalize your experience</p>
              </div>
            </button>
          )}

          {/* Other profiles */}
          {profiles.length > 1 && (
            <div className="border-t border-white/[0.04]">
              <p className="px-4 pt-3 pb-2 text-[11px] text-white/20 uppercase tracking-widest font-medium">Switch Profile</p>
              {profiles
                .filter((p) => p.id !== activeProfile?.id)
                .map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => switchProfile(profile)}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] flex-shrink-0"
                      style={{ backgroundColor: profile.color + "20" }}
                    >
                      {profile.avatar}
                    </div>
                    <span className="text-[13px] text-white/60">{profile.name}</span>
                  </button>
                ))}
            </div>
          )}

          {/* Add another profile button */}
          {profiles.length > 0 && profiles.length < 5 && (
            <button
              onClick={() => {
                setEditingProfile(null);
                setShowProfileEditor(true);
              }}
              className="w-full px-4 py-3 flex items-center gap-3 border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-white/30">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="text-[13px] text-white/40">Add Profile</span>
            </button>
          )}
        </SettingSection>

        {/* ─── Playback Section ─── */}
        <SettingSection title="Playback">
          {/* Audio Quality */}
          <div className="relative">
            <button
              onClick={() => setShowQualityPicker(!showQualityPicker)}
              className="w-full"
            >
              <SettingRow
                label="Audio Quality"
                value={settings.audioQuality === "low" ? "Low" : settings.audioQuality === "normal" ? "Normal" : "High"}
              />
            </button>
            {showQualityPicker && (
              <div className="px-4 pb-3 space-y-1">
                {(["low", "normal", "high"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      updateSetting("audioQuality", q);
                      setShowQualityPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                      settings.audioQuality === q
                        ? "bg-white/[0.1] text-white"
                        : "text-white/50 hover:bg-white/[0.05]"
                    }`}
                  >
                    {q === "low" ? "Low — saves data" : q === "normal" ? "Normal — balanced" : "High — best quality"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Crossfade */}
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] text-white/80">Crossfade</span>
              <span className="text-[13px] text-white/25 tabular-nums">
                {settings.crossfadeDuration === 0 ? "Off" : `${settings.crossfadeDuration}s`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={settings.crossfadeDuration}
              onChange={(e) => updateSetting("crossfadeDuration", Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Gapless Playback */}
          <ToggleRow
            label="Gapless Playback"
            subtitle="Seamless transitions between tracks"
            enabled={settings.gaplessPlayback}
            onToggle={() => updateSetting("gaplessPlayback", !settings.gaplessPlayback)}
          />

          {/* Auto-Play */}
          <ToggleRow
            label="Auto-Play"
            subtitle="Play similar songs when queue ends"
            enabled={settings.autoPlay}
            onToggle={() => updateSetting("autoPlay", !settings.autoPlay)}
          />

          {/* Volume Normalization */}
          <ToggleRow
            label="Normalize Volume"
            subtitle="Set all tracks to the same volume level"
            enabled={settings.normalizeVolume}
            onToggle={() => updateSetting("normalizeVolume", !settings.normalizeVolume)}
          />
        </SettingSection>

        {/* ─── Equalizer Section ─── */}
        <SettingSection title="Equalizer">
          <ToggleRow
            label="Equalizer"
            subtitle={eqEnabled ? `Active — ${activePreset}` : "Off"}
            enabled={eqEnabled}
            onToggle={toggleEQ}
          />

          {eqEnabled && (
            <div className="relative">
              <button
                onClick={() => setShowEQPresets(!showEQPresets)}
                className="w-full"
              >
                <SettingRow label="Preset" value={activePreset} />
              </button>
              {showEQPresets && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
                  {getAllPresets().map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        applyPreset(preset);
                        setShowEQPresets(false);
                      }}
                      className={`text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                        activePreset === preset.name
                          ? "bg-white/[0.1] text-white"
                          : "text-white/50 hover:bg-white/[0.05]"
                      }`}
                    >
                      {preset.name}
                      {preset.isCustom && <span className="text-[10px] text-white/20 ml-1">custom</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </SettingSection>

        {/* ─── Lyrics Section ─── */}
        <SettingSection title="Lyrics">
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] text-white/80">Timing Offset</span>
              <span className="text-[13px] text-white/25 tabular-nums">
                {settings.lyricsOffset === 0 ? "0s" : `${settings.lyricsOffset > 0 ? "+" : ""}${settings.lyricsOffset.toFixed(1)}s`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting("lyricsOffset", Math.max(-10, settings.lyricsOffset - 0.5))}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/50 text-[16px] font-medium transition-colors flex-shrink-0 active:scale-90"
              >
                −
              </button>
              <input
                type="range"
                min={-10}
                max={10}
                step={0.1}
                value={settings.lyricsOffset}
                onChange={(e) => updateSetting("lyricsOffset", Number(e.target.value))}
                className="flex-1"
              />
              <button
                onClick={() => updateSetting("lyricsOffset", Math.min(10, settings.lyricsOffset + 0.5))}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/50 text-[16px] font-medium transition-colors flex-shrink-0 active:scale-90"
              >
                +
              </button>
            </div>
            <p className="text-[11px] text-white/20 mt-2">Adjust sync between lyrics and audio</p>
          </div>
        </SettingSection>

        {/* ─── Appearance Section ─── */}
        <SettingSection title="Appearance">
          <ToggleRow
            label="Dynamic Colors"
            subtitle="Background changes based on album art"
            enabled={settings.dynamicColors}
            onToggle={() => updateSetting("dynamicColors", !settings.dynamicColors)}
          />
          <ToggleRow
            label="Show Music Videos"
            subtitle="Display video section on artist pages"
            enabled={settings.showMusicVideos}
            onToggle={() => updateSetting("showMusicVideos", !settings.showMusicVideos)}
          />
        </SettingSection>

        {/* ─── Storage Section ─── */}
        <SettingSection title="Storage & Data">
          <SettingRow label="Liked Songs" value={`${likedSongs.length} songs`} />
          <SettingRow label="Playlists" value={`${playlists.length}`} />
          <SettingRow label="History" value={`${history.length} songs`} />
          <SettingRow label="Following" value={`${followedArtists.length} artists`} />
          <SettingRow label="Cache Size" value={cacheSize} />
          <button onClick={clearCache} className="w-full">
            <SettingRow label="Clear Cache" value="" action />
          </button>
        </SettingSection>

        {/* ─── About Section ─── */}
        <SettingSection title="About">
          <SettingRow label="App" value="Wavely" />
          <SettingRow label="Version" value="1.0.0" />
          <SettingRow label="Built with" value="Next.js + Piped" />
        </SettingSection>
      </div>

      {/* ─── Profile Editor Modal ─── */}
      {showProfileEditor && (
        <ProfileEditor
          profile={editingProfile}
          onSave={(profile) => {
            saveProfile(profile);
            setShowProfileEditor(false);
            setEditingProfile(null);
          }}
          onDelete={
            editingProfile
              ? () => {
                  deleteProfile(editingProfile.id);
                  setShowProfileEditor(false);
                  setEditingProfile(null);
                }
              : undefined
          }
          onClose={() => {
            setShowProfileEditor(false);
            setEditingProfile(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] text-white/25 uppercase tracking-[0.12em] font-semibold mb-2.5 pl-1">
        {title}
      </h2>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.04] overflow-hidden divide-y divide-white/[0.04]">
        {children}
      </div>
    </section>
  );
}

function SettingRow({ label, value, action }: { label: string; value: string; action?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors cursor-pointer">
      <span className={`text-[14px] ${action ? "text-red-400" : "text-white/80"}`}>
        {label}
      </span>
      {value && (
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] text-white/25">{value}</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5 text-white/15">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  subtitle,
  enabled,
  onToggle,
}: {
  label: string;
  subtitle?: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-colors">
      <div className="text-left">
        <p className="text-[14px] text-white/80">{label}</p>
        {subtitle && <p className="text-[11px] text-white/25 mt-0.5">{subtitle}</p>}
      </div>
      <div
        className={`w-[44px] h-[26px] rounded-full relative transition-colors duration-200 flex-shrink-0 ${
          enabled ? "bg-emerald-500" : "bg-white/[0.12]"
        }`}
      >
        <div
          className={`absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? "translate-x-[21px]" : "translate-x-[3px]"
          }`}
        />
      </div>
    </button>
  );
}

// ─── Profile Editor Modal ──────────────────────────────────────────

function ProfileEditor({
  profile,
  onSave,
  onDelete,
  onClose,
}: {
  profile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile?.name || "");
  const [avatar, setAvatar] = useState(profile?.avatar || "🎵");
  const [color, setColor] = useState(profile?.color || "#1ed760");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditing = !!profile;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: profile?.id || `profile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      avatar,
      color,
      createdAt: profile?.createdAt || Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-[520px] bg-[#1a1a1e] rounded-t-3xl p-6 animate-slideUp max-h-[85vh] overflow-y-auto scrollbar-hide">
        {/* Handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.15]" />

        <h2 className="text-[20px] font-bold mt-2 mb-6">{isEditing ? "Edit Profile" : "Create Profile"}</h2>

        {/* Preview */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-[36px] mb-3 transition-all"
            style={{ backgroundColor: color + "25", border: `3px solid ${color}` }}
          >
            {avatar}
          </div>
          <p className="text-[16px] font-semibold">{name || "Your Name"}</p>
        </div>

        {/* Name Input */}
        <div className="mb-5">
          <label className="text-[11px] text-white/25 uppercase tracking-widest font-medium mb-2 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-[15px] text-white placeholder-white/20 outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Avatar Picker */}
        <div className="mb-5">
          <label className="text-[11px] text-white/25 uppercase tracking-widest font-medium mb-2 block">Avatar</label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_OPTIONS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-[20px] transition-all ${
                  avatar === a
                    ? "bg-white/[0.15] ring-2 ring-white/30 scale-110"
                    : "bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div className="mb-8">
          <label className="text-[11px] text-white/25 uppercase tracking-widest font-medium mb-2 block">Accent Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === c ? "ring-2 ring-offset-2 ring-offset-[#1a1a1e] scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c, ringColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {onDelete && (
            <button
              onClick={() => {
                if (confirmDelete) onDelete();
                else setConfirmDelete(true);
              }}
              className={`px-5 py-3 rounded-xl text-[14px] font-medium transition-colors ${
                confirmDelete
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-white/[0.06] text-red-400 hover:bg-red-500/10"
              }`}
            >
              {confirmDelete ? "Confirm?" : "Delete"}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/[0.06] text-[14px] font-medium text-white/60 hover:bg-white/[0.1] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isEditing ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
