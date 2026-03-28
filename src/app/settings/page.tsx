"use client";

import { useState, useEffect, useCallback } from "react";
import { useLibrary } from "@/hooks/useLibrary";
import { useEqualizer } from "@/hooks/useEqualizer";
import { useAuth } from "@/hooks/useAuth";
import { Song } from "@/types/song";
import { Artist } from "@/types/artist";
import { Playlist } from "@/types/playlist";

// ─── Constants ─────────────────────────────────────────────────────

const AVATAR_OPTIONS = ["🎵", "🎧", "🎤", "🎸", "🎹", "🎷", "🎺", "🥁", "🎻", "🪗", "🎶", "🎼", "🌊", "⚡", "🔥", "💜", "🖤", "💚", "🤍", "👤"];
const COLOR_OPTIONS = [
  "#1ed760", "#1db954", "#e91e63", "#9c27b0", "#673ab7",
  "#3f51b5", "#2196f3", "#00bcd4", "#009688", "#ff5722",
  "#ff9800", "#ffc107", "#8bc34a", "#607d8b", "#ffffff",
];

const SETTINGS_STORAGE_KEY = "wavely_settings";

interface AppSettings {
  audioQuality: "low" | "normal" | "high";
  crossfadeDuration: number;
  gaplessPlayback: boolean;
  dynamicColors: boolean;
  lyricsOffset: number;
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
  try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

// ─── Main Settings Page ────────────────────────────────────────────

export default function Settings() {
  const { likedSongs, history, playlists, followedArtists, loadFromCloud } = useLibrary();
  const { enabled: eqEnabled, activePreset, toggleEQ, applyPreset, getAllPresets } = useEqualizer();
  const { user, loading: authLoading, login, signup, logout, updateProfile, syncPull } = useAuth();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showEQPresets, setShowEQPresets] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [cacheSize, setCacheSize] = useState("0 MB");
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    setSettings(loadSettings());
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("wavely_")) {
          total += (localStorage.getItem(key) || "").length * 2;
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
      const keysToKeep = [SETTINGS_STORAGE_KEY, "wavely_auth_token", "wavely_liked_songs", "wavely_playlists", "wavely_followed_artists"];
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

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const data = await syncPull();
      if (data) {
        loadFromCloud({
          likedSongs: data.likedSongs as Song[],
          playlists: data.playlists as Playlist[],
          followedArtists: data.followedArtists as Artist[],
          history: data.history as Song[],
        });
        setSyncMessage("Synced!");
        setTimeout(() => setSyncMessage(""), 2000);
      } else {
        setSyncMessage("Sync failed");
        setTimeout(() => setSyncMessage(""), 2000);
      }
    } catch {
      setSyncMessage("Sync failed");
      setTimeout(() => setSyncMessage(""), 2000);
    }
    setSyncing(false);
  }, [syncPull, loadFromCloud]);

  return (
    <div className="animate-fadeIn px-5 pt-14 pb-40">
      <h1 className="text-[28px] font-bold tracking-tight mb-6">Settings</h1>

      <div className="space-y-8">
        {/* ─── Account Section ─── */}
        <SettingSection title="Account">
          {authLoading ? (
            <div className="px-4 py-6 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
            </div>
          ) : user ? (
            <>
              {/* Logged-in user card */}
              <div className="px-4 py-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-[22px] flex-shrink-0"
                    style={{ backgroundColor: (user.accentColor || "#1ed760") + "25", border: `2px solid ${user.accentColor || "#1ed760"}` }}
                  >
                    {user.avatar || "🎵"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-semibold text-white truncate">{user.displayName}</p>
                    <p className="text-[12px] text-white/30 mt-0.5">
                      @{user.username} · {likedSongs.length} liked · {playlists.length} playlists
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEditProfile(true)}
                    className="p-2 rounded-full hover:bg-white/[0.08] transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-[18px] h-[18px] text-white/40">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Sync button */}
              <button onClick={handleSync} disabled={syncing} className="w-full">
                <div className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={`w-4 h-4 text-white/50 ${syncing ? "animate-spin" : ""}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                    <span className="text-[14px] text-white/80">Sync from Cloud</span>
                  </div>
                  {syncMessage && (
                    <span className={`text-[12px] ${syncMessage === "Synced!" ? "text-emerald-400" : "text-red-400"}`}>
                      {syncMessage}
                    </span>
                  )}
                </div>
              </button>

              {/* Sign out */}
              <button
                onClick={async () => {
                  await logout();
                }}
                className="w-full"
              >
                <div className="flex items-center px-4 py-3.5 hover:bg-white/[0.03] transition-colors">
                  <span className="text-[14px] text-red-400">Sign Out</span>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* Not logged in */}
              <div className="px-4 py-5">
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-white/30">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] text-white/80 font-medium">Sign in to sync your data</p>
                    <p className="text-[12px] text-white/30 mt-0.5">Access your music across all devices</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAuthMode("login")}
                    className="flex-1 py-2.5 rounded-xl bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setAuthMode("signup")}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.08] text-white text-[14px] font-medium hover:bg-white/[0.12] transition-colors"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </>
          )}
        </SettingSection>

        {/* ─── Playback Section ─── */}
        <SettingSection title="Playback">
          <div className="relative">
            <button onClick={() => setShowQualityPicker(!showQualityPicker)} className="w-full">
              <SettingRow label="Audio Quality" value={settings.audioQuality === "low" ? "Low" : settings.audioQuality === "normal" ? "Normal" : "High"} />
            </button>
            {showQualityPicker && (
              <div className="px-4 pb-3 space-y-1">
                {(["low", "normal", "high"] as const).map((q) => (
                  <button key={q} onClick={() => { updateSetting("audioQuality", q); setShowQualityPicker(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${settings.audioQuality === q ? "bg-white/[0.1] text-white" : "text-white/50 hover:bg-white/[0.05]"}`}
                  >
                    {q === "low" ? "Low — saves data" : q === "normal" ? "Normal — balanced" : "High — best quality"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] text-white/80">Crossfade</span>
              <span className="text-[13px] text-white/25 tabular-nums">{settings.crossfadeDuration === 0 ? "Off" : `${settings.crossfadeDuration}s`}</span>
            </div>
            <input type="range" min={0} max={12} step={1} value={settings.crossfadeDuration} onChange={(e) => updateSetting("crossfadeDuration", Number(e.target.value))} className="w-full" />
          </div>

          <ToggleRow label="Gapless Playback" subtitle="Seamless transitions between tracks" enabled={settings.gaplessPlayback} onToggle={() => updateSetting("gaplessPlayback", !settings.gaplessPlayback)} />
          <ToggleRow label="Auto-Play" subtitle="Play similar songs when queue ends" enabled={settings.autoPlay} onToggle={() => updateSetting("autoPlay", !settings.autoPlay)} />
          <ToggleRow label="Normalize Volume" subtitle="Set all tracks to the same volume level" enabled={settings.normalizeVolume} onToggle={() => updateSetting("normalizeVolume", !settings.normalizeVolume)} />
        </SettingSection>

        {/* ─── Equalizer ─── */}
        <SettingSection title="Equalizer">
          <ToggleRow label="Equalizer" subtitle={eqEnabled ? `Active — ${activePreset}` : "Off"} enabled={eqEnabled} onToggle={toggleEQ} />
          {eqEnabled && (
            <div className="relative">
              <button onClick={() => setShowEQPresets(!showEQPresets)} className="w-full">
                <SettingRow label="Preset" value={activePreset} />
              </button>
              {showEQPresets && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
                  {getAllPresets().map((preset) => (
                    <button key={preset.name} onClick={() => { applyPreset(preset); setShowEQPresets(false); }}
                      className={`text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${activePreset === preset.name ? "bg-white/[0.1] text-white" : "text-white/50 hover:bg-white/[0.05]"}`}
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

        {/* ─── Lyrics ─── */}
        <SettingSection title="Lyrics">
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] text-white/80">Timing Offset</span>
              <span className="text-[13px] text-white/25 tabular-nums">
                {settings.lyricsOffset === 0 ? "0s" : `${settings.lyricsOffset > 0 ? "+" : ""}${settings.lyricsOffset.toFixed(1)}s`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateSetting("lyricsOffset", Math.max(-10, settings.lyricsOffset - 0.5))}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/50 text-[16px] font-medium transition-colors flex-shrink-0 active:scale-90">−</button>
              <input type="range" min={-10} max={10} step={0.1} value={settings.lyricsOffset} onChange={(e) => updateSetting("lyricsOffset", Number(e.target.value))} className="flex-1" />
              <button onClick={() => updateSetting("lyricsOffset", Math.min(10, settings.lyricsOffset + 0.5))}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/50 text-[16px] font-medium transition-colors flex-shrink-0 active:scale-90">+</button>
            </div>
            <p className="text-[11px] text-white/20 mt-2">Adjust sync between lyrics and audio</p>
          </div>
        </SettingSection>

        {/* ─── Appearance ─── */}
        <SettingSection title="Appearance">
          <ToggleRow label="Dynamic Colors" subtitle="Background changes based on album art" enabled={settings.dynamicColors} onToggle={() => updateSetting("dynamicColors", !settings.dynamicColors)} />
          <ToggleRow label="Show Music Videos" subtitle="Display video section on artist pages" enabled={settings.showMusicVideos} onToggle={() => updateSetting("showMusicVideos", !settings.showMusicVideos)} />
        </SettingSection>

        {/* ─── Storage ─── */}
        <SettingSection title="Storage & Data">
          <SettingRow label="Liked Songs" value={`${likedSongs.length} songs`} />
          <SettingRow label="Playlists" value={`${playlists.length}`} />
          <SettingRow label="History" value={`${history.length} songs`} />
          <SettingRow label="Following" value={`${followedArtists.length} artists`} />
          <SettingRow label="Cache Size" value={cacheSize} />
          <button onClick={clearCache} className="w-full"><SettingRow label="Clear Cache" value="" action /></button>
        </SettingSection>

        {/* ─── About ─── */}
        <SettingSection title="About">
          <SettingRow label="App" value="Wavely" />
          <SettingRow label="Version" value="1.0.0" />
          <SettingRow label="Built with" value="Next.js + Piped" />
        </SettingSection>
      </div>

      {/* ─── Auth Modal ─── */}
      {authMode && (
        <AuthModal
          mode={authMode}
          onSwitchMode={(m) => setAuthMode(m)}
          onLogin={login}
          onSignup={signup}
          onSuccess={() => {
            setAuthMode(null);
            // Pull cloud data after login
            handleSync();
          }}
          onClose={() => setAuthMode(null)}
        />
      )}

      {/* ─── Edit Profile Modal ─── */}
      {showEditProfile && user && (
        <EditProfileModal
          user={user}
          onSave={async (updates) => {
            await updateProfile(updates);
            setShowEditProfile(false);
          }}
          onClose={() => setShowEditProfile(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] text-white/25 uppercase tracking-[0.12em] font-semibold mb-2.5 pl-1">{title}</h2>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.04] overflow-hidden divide-y divide-white/[0.04]">{children}</div>
    </section>
  );
}

function SettingRow({ label, value, action }: { label: string; value: string; action?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors cursor-pointer">
      <span className={`text-[14px] ${action ? "text-red-400" : "text-white/80"}`}>{label}</span>
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

function ToggleRow({ label, subtitle, enabled, onToggle }: { label: string; subtitle?: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] transition-colors">
      <div className="text-left">
        <p className="text-[14px] text-white/80">{label}</p>
        {subtitle && <p className="text-[11px] text-white/25 mt-0.5">{subtitle}</p>}
      </div>
      <div className={`w-[44px] h-[26px] rounded-full relative transition-colors duration-200 flex-shrink-0 ${enabled ? "bg-emerald-500" : "bg-white/[0.12]"}`}>
        <div className={`absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white shadow transition-transform duration-200 ${enabled ? "translate-x-[21px]" : "translate-x-[3px]"}`} />
      </div>
    </button>
  );
}

// ─── Auth Modal ────────────────────────────────────────────────────

function AuthModal({
  mode,
  onSwitchMode,
  onLogin,
  onSignup,
  onSuccess,
  onClose,
}: {
  mode: "login" | "signup";
  onSwitchMode: (mode: "login" | "signup") => void;
  onLogin: (username: string, password: string) => Promise<{ error?: string }>;
  onSignup: (username: string, password: string, displayName?: string) => Promise<{ error?: string }>;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");

    let result: { error?: string };
    if (mode === "login") {
      result = await onLogin(username, password);
    } else {
      result = await onSignup(username, password, displayName || username);
    }

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0a0a0c]">
      {/* Header */}
      <div className="flex items-center px-5 pt-14 pb-4 flex-shrink-0">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/[0.08] transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 text-white/70">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-10">
        <h2 className="text-[28px] font-bold mb-1">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p className="text-[14px] text-white/40 mb-8">
          {mode === "login" ? "Sign in to sync your music across devices" : "Join Wavely to save your music everywhere"}
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-[13px] text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {mode === "signup" && (
            <div>
              <label className="text-[11px] text-white/25 uppercase tracking-widest font-medium mb-1.5 block">Display Name</label>
              <input
                type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                maxLength={30}
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-[15px] text-white placeholder-white/20 outline-none focus:border-white/20 transition-colors"
              />
            </div>
          )}
          <div>
            <label className="text-[11px] text-white/25 uppercase tracking-widest font-medium mb-1.5 block">Username</label>
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="your_username"
              maxLength={20}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-[15px] text-white placeholder-white/20 outline-none focus:border-white/20 transition-colors font-mono"
              autoCapitalize="none"
              autoCorrect="off"
            />
            {mode === "signup" && username.length > 0 && username.length < 3 && (
              <p className="text-[11px] text-amber-400/60 mt-1">At least 3 characters</p>
            )}
          </div>
          <div>
            <label className="text-[11px] text-white/25 uppercase tracking-widest font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "Enter password"}
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 pr-12 text-[15px] text-white placeholder-white/20 outline-none focus:border-white/20 transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/50"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !username.trim() || !password || (mode === "signup" && (username.length < 3 || password.length < 6))}
          className="w-full py-3.5 rounded-xl bg-white text-black text-[15px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mb-4"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
              {mode === "login" ? "Signing in..." : "Creating account..."}
            </span>
          ) : (
            mode === "login" ? "Sign In" : "Create Account"
          )}
        </button>

        <p className="text-center text-[13px] text-white/30">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { onSwitchMode(mode === "login" ? "signup" : "login"); setError(""); }}
            className="text-white/60 hover:text-white underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── Edit Profile Modal ────────────────────────────────────────────

function EditProfileModal({
  user,
  onSave,
  onClose,
}: {
  user: { displayName: string; avatar: string; accentColor: string };
  onSave: (updates: { displayName?: string; avatar?: string; accentColor?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatar, setAvatar] = useState(user.avatar || "🎵");
  const [accentColor, setAccentColor] = useState(user.accentColor || "#1ed760");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ displayName: displayName.trim(), avatar, accentColor });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-[#1a1a1e] rounded-t-3xl p-6 animate-slideUp max-h-[85vh] overflow-y-auto scrollbar-hide">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.15]" />

        <h2 className="text-[20px] font-bold mt-2 mb-6">Edit Profile</h2>

        {/* Preview */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-[36px] mb-3 transition-all"
            style={{ backgroundColor: accentColor + "25", border: `3px solid ${accentColor}` }}
          >
            {avatar}
          </div>
          <p className="text-[16px] font-semibold">{displayName || "Your Name"}</p>
        </div>

        {/* Name */}
        <div className="mb-5">
          <label className="text-[11px] text-white/25 uppercase tracking-widest font-medium mb-2 block">Display Name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name"
            maxLength={30} className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-[15px] text-white placeholder-white/20 outline-none focus:border-white/20 transition-colors" />
        </div>

        {/* Avatar */}
        <div className="mb-5">
          <label className="text-[11px] text-white/25 uppercase tracking-widest font-medium mb-2 block">Avatar</label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_OPTIONS.map((a) => (
              <button key={a} onClick={() => setAvatar(a)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-[20px] transition-all ${avatar === a ? "bg-white/[0.15] ring-2 ring-white/30 scale-110" : "bg-white/[0.04] hover:bg-white/[0.08]"}`}
              >{a}</button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="mb-8">
          <label className="text-[11px] text-white/25 uppercase tracking-widest font-medium mb-2 block">Accent Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button key={c} onClick={() => setAccentColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${accentColor === c ? "ring-2 ring-offset-2 ring-offset-[#1a1a1e] scale-110" : "hover:scale-105"}`}
                style={{ backgroundColor: c, ["--tw-ring-color" as string]: c } as React.CSSProperties}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/[0.06] text-[14px] font-medium text-white/60 hover:bg-white/[0.1] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !displayName.trim()}
            className="flex-1 py-3 rounded-xl bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
