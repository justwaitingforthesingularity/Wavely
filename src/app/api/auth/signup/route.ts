import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { hashPassword, generateToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password, displayName } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return NextResponse.json({ error: "Username must be 3-20 characters" }, { status: 400 });
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Check if username already taken
    const { data: existing } = await supabase
      .from("wavely_users")
      .select("id")
      .eq("username", cleanUsername)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const { data: user, error: createError } = await supabase
      .from("wavely_users")
      .insert({
        username: cleanUsername,
        password_hash: passwordHash,
        display_name: (displayName || username).trim().slice(0, 30),
      })
      .select("id, username, display_name, avatar, accent_color, created_at")
      .single();

    if (createError) {
      console.error("Create user error:", createError);
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    // Create session token
    const token = generateToken();
    await supabase.from("wavely_sessions").insert({
      user_id: user.id,
      token,
      device_name: req.headers.get("user-agent")?.slice(0, 100) || "Unknown",
    });

    // Initialize user settings
    await supabase.from("wavely_user_settings").insert({
      user_id: user.id,
      settings: {},
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar,
        accentColor: user.accent_color,
      },
      token,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
