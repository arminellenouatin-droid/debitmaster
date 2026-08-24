// DebitManager security boundary: résolution serveur des tenants possédés par la session courante.
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOwnedTenantIds() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, user: null, tenantIds: [] as string[] };
  const { data: companies, error } = await supabase.from("companies").select("id").eq("owner_user_id", auth.user.id).is("deleted_at", null).limit(50);
  if (error) throw new Error("Impossible de vérifier les établissements.");
  return { supabase, user: auth.user, tenantIds: (companies ?? []).map((company) => company.id) };
}
