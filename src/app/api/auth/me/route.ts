import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Find valid session
    const { data: session } = await supabase
      .from("wavely_sessions")
      .select("user_id, expires_at")
      .eq("token", token)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await supabase.from("wavely_sessions").delete().eq("token", token);
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    // Get user
    const { data: user } = await supabase
      .from("wavely_users")
      .select("id, username, display_name, avatar, accent_color")
      .eq("id", session.user_id)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar,
        accentColor: user.accent_color,
      },
    });
  } catch (err) {
    console.error("Auth check error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
