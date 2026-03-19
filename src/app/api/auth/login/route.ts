import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyPassword, generateToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();

    // Find user
    const { data: user, error } = await supabase
      .from("wavely_users")
      .select("id, username, display_name, avatar, accent_color, password_hash")
      .eq("username", cleanUsername)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // Create session
    const token = generateToken();
    await supabase.from("wavely_sessions").insert({
      user_id: user.id,
      token,
      device_name: req.headers.get("user-agent")?.slice(0, 100) || "Unknown",
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
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
