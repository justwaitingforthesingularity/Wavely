import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: session } = await supabase
      .from("wavely_sessions")
      .select("user_id")
      .eq("token", token)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { displayName, avatar, accentColor } = await req.json();

    const updates: Record<string, string> = {};
    if (displayName !== undefined) updates.display_name = displayName.trim().slice(0, 30);
    if (avatar !== undefined) updates.avatar = avatar;
    if (accentColor !== undefined) updates.accent_color = accentColor;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from("wavely_users")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", session.user_id)
      .select("id, username, display_name, avatar, accent_color")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
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
    console.error("Update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
