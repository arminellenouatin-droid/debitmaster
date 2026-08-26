// DebitManager avatar API: private image storage scoped to the authenticated user.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("avatar");
    if (!(file instanceof File)) return NextResponse.json({ error: "Sélectionnez une image." }, { status: 400 });
    if (!allowedTypes.has(file.type) || file.size > maxBytes) return NextResponse.json({ error: "La photo doit être au format JPG, PNG ou WebP et ne pas dépasser 2 Mo." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await admin.storage.from("profile-avatars").upload(path, file, { contentType: file.type, upsert: true, cacheControl: "3600" });
    if (uploadError) return NextResponse.json({ error: "Impossible d’enregistrer la photo pour le moment." }, { status: 500 });

    const { error: profileError } = await admin.from("profiles").update({ avatar_path: path, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (profileError) return NextResponse.json({ error: "Photo enregistrée, mais le profil n’a pas pu être synchronisé." }, { status: 409 });
    await supabase.auth.updateUser({ data: { ...user.user_metadata, avatar_path: path } });
    const { data: signed } = await admin.storage.from("profile-avatars").createSignedUrl(path, 3600);
    return NextResponse.json({ ok: true, avatarUrl: signed?.signedUrl ?? null });
  } catch {
    return NextResponse.json({ error: "Impossible d’enregistrer la photo pour le moment." }, { status: 500 });
  }
}
