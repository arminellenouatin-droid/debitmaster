// DebitManager profile settings: private identity, security and avatar controls for the authenticated account.
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DashboardShell } from "@/components/DashboardShell";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

type SettingsPageProps = { searchParams: Promise<{ firstLogin?: string }> };

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  const { data: employee } = await supabase.from("employees").select("must_change_password,status").eq("user_id", auth.user.id).is("deleted_at", null).maybeSingle();
  const { data: profile } = await supabase.from("profiles").select("first_name,last_name,email,phone,avatar_path,must_change_password").eq("id", auth.user.id).maybeSingle();
  const params = await searchParams;
  const mustChangePassword = Boolean(employee?.must_change_password && employee.status === "ACTIVE") || Boolean(profile?.must_change_password) || params.firstLogin === "1" && Boolean(employee?.must_change_password || profile?.must_change_password);
  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    try {
      const admin = createSupabaseAdminClient();
      const { data: signed } = await admin.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    } catch { avatarUrl = null; }
  }
  const firstName = profile?.first_name ?? auth.user.user_metadata?.first_name ?? "";
  const lastName = profile?.last_name ?? auth.user.user_metadata?.last_name ?? "";
  const email = profile?.email ?? auth.user.email ?? "";
  const phone = profile?.phone ?? auth.user.phone ?? "";
  return <DashboardShell firstName={firstName || "gérant"}><SettingsClient firstName={firstName} lastName={lastName} email={email} phone={phone} avatarUrl={avatarUrl} mustChangePassword={mustChangePassword} /></DashboardShell>;
}
