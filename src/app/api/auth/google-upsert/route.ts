import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { supabaseId, email, displayName, photoUrl } = await req.json();

    if (!supabaseId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Generate a username from email (before the @, sanitized)
    const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 18);

    // Check if user already exists (by supabase_id stored in username prefix or email match)
    // We use a convention: google users get username = `g_<email-prefix>`
    const googleUsername = `g_${baseUsername}`;

    const { data: existing } = await supabase
      .from("wavely_users")
      .select("id, username, display_name, avatar, accent_color")
      .eq("username", googleUsername)
      .single();

    let userId: string;
    let user: { id: string; username: string; displayName: string; avatar: string; accentColor: string; email: string; photoUrl: string };

    if (existing) {
      // User exists — update display name / photo if changed
      userId = existing.id;
      user = {
        id: existing.id,
        username: existing.username,
        displayName: existing.display_name,
        avatar: existing.avatar,
        accentColor: existing.accent_color,
        email,
        photoUrl: photoUrl || "",
      };
    } else {
      // Create new user for this Google account
      // Use a random password hash since they'll only sign in via Google
      const { data: newUser, error: createError } = await supabase
        .from("wavely_users")
        .insert({
          username: googleUsername,
          password_hash: `google_oauth_${supabaseId}`,
          display_name: displayName || baseUsername,
          avatar: "🎵",
          accent_color: "#1ed760",
        })
        .select("id, username, display_name, avatar, accent_color")
        .single();

      if (createError || !newUser) {
        console.error("Google user create error:", createError);
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
      }

      userId = newUser.id;
      user = {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.display_name,
        avatar: newUser.avatar,
        accentColor: newUser.accent_color,
        email,
        photoUrl: photoUrl || "",
      };

      // Initialize user settings
      await supabase.from("wavely_user_settings").insert({
        user_id: userId,
        settings: {},
      });
    }

    // Create a session token (same as regular login)
    const token = generateToken();
    await supabase.from("wavely_sessions").insert({
      user_id: userId,
      token,
      device_name: req.headers.get("user-agent")?.slice(0, 100) || "Google OAuth",
    });

    return NextResponse.json({ user, token });
  } catch (err) {
    console.error("Google upsert error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
