"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  accentColor: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  token: string | null;
}

interface AuthActions {
  signup: (username: string, password: string, displayName?: string) => Promise<{ error?: string }>;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<AuthUser, "displayName" | "avatar" | "accentColor">>) => Promise<{ error?: string }>;
  syncPush: (type: string, action: string, data: Record<string, unknown>) => Promise<void>;
  syncPull: () => Promise<SyncData | null>;
}

export interface SyncData {
  likedSongs: unknown[];
  playlists: unknown[];
  followedArtists: unknown[];
  history: unknown[];
  settings: Record<string, unknown>;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

const TOKEN_KEY = "wavely_auth_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    token: null,
  });
  const mountedRef = useRef(true);

  // Restore session on mount
  useEffect(() => {
    mountedRef.current = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (mountedRef.current) {
            if (data.user) {
              setState({ user: data.user, loading: false, token });
            } else {
              localStorage.removeItem(TOKEN_KEY);
              setState({ user: null, loading: false, token: null });
            }
          }
        })
        .catch(() => {
          if (mountedRef.current) {
            setState({ user: null, loading: false, token: null });
          }
        });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
    return () => { mountedRef.current = false; };
  }, []);

  const signup = useCallback(async (username: string, password: string, displayName?: string) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Signup failed" };
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      setState({ user: data.user, loading: false, token: data.token });
      return {};
    } catch {
      return { error: "Network error" };
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Login failed" };
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      setState({ user: data.user, loading: false, token: data.token });
      return {};
    } catch {
      return { error: "Network error" };
    }
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, loading: false, token: null });
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Pick<AuthUser, "displayName" | "avatar" | "accentColor">>) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { error: "Not authenticated" };

    try {
      const res = await fetch("/api/auth/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Update failed" };
      }

      setState((prev) => ({ ...prev, user: data.user }));
      return {};
    } catch {
      return { error: "Network error" };
    }
  }, []);

  const syncPush = useCallback(async (type: string, action: string, data: Record<string, unknown>) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, action, data }),
      });
    } catch {
      // Silently fail - data is still in localStorage
    }
  }, []);

  const syncPull = useCallback(async (): Promise<SyncData | null> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      const res = await fetch("/api/sync", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signup,
        login,
        logout,
        updateProfile,
        syncPush,
        syncPull,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
