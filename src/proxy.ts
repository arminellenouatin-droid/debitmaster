// DebitManager route guard: authentication, tenant access requests and subscription expiry are checked before private screens.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const subscriptionIsExpired = (company: { status?: string | null; trial_ends_at?: string | null; subscription_expires_at?: string | null }) => {
  const status = String(company.status ?? "").toUpperCase();
  if (["SUSPENDED", "EXPIRED", "CANCELLED"].includes(status)) return true;
  const cutoff = company.subscription_expires_at || company.trial_ends_at;
  return Boolean(cutoff && new Date(cutoff).getTime() <= Date.now());
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("tenant_id,user_type,role,status").eq("id", user.id).maybeSingle() : { data: null };
  const isPlatformAdmin = (candidate: { user_type?: string | null; role?: string | null; status?: string | null } | null) => candidate?.user_type === "SUPER_ADMIN" && candidate.role === "MASTER_ADMIN" && candidate.status === "ACTIVE";
  const isPrivateArea = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/affilie");
  if (!isPrivateArea) return response;
  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/connexion";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const { data: accessRequest } = await supabase.from("employee_access_requests").select("status").eq("user_id", user.id).order("requested_at", { ascending: false }).limit(1).maybeSingle();
  if (request.nextUrl.pathname.startsWith("/admin") && !isPlatformAdmin(profile)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/connexion";
    redirectUrl.searchParams.set("error", "acces_master_requis");
    return NextResponse.redirect(redirectUrl);
  }
  if (request.nextUrl.pathname.startsWith("/affilie") && !(profile?.user_type === "AFFILIATE" && profile.status === "ACTIVE")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/connexion";
    redirectUrl.searchParams.set("error", "acces_affilie_requis");
    return NextResponse.redirect(redirectUrl);
  }
  if (request.nextUrl.pathname.startsWith("/dashboard") && profile?.user_type === "AFFILIATE" && !request.nextUrl.pathname.startsWith("/dashboard/settings")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/affilie";
    redirectUrl.searchParams.set("error", "espace_affilie");
    return NextResponse.redirect(redirectUrl);
  }
  if (accessRequest && accessRequest.status !== "APPROVED") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/connexion";
    redirectUrl.searchParams.set("error", accessRequest.status === "PENDING" ? "validation_en_attente" : "acces_refuse");
    return NextResponse.redirect(redirectUrl);
  }

  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const requestedTenantId = request.cookies.get("debitmanager_active_tenant")?.value ?? "";
    let company: { id: string; owner_user_id: string | null; status: string | null; trial_ends_at: string | null; subscription_expires_at: string | null } | null = null;
    if (uuidPattern.test(requestedTenantId)) {
      const { data } = await supabase.from("companies").select("id,owner_user_id,status,trial_ends_at,subscription_expires_at").eq("id", requestedTenantId).is("deleted_at", null).maybeSingle();
      company = data;
    }
    if (!company && profile?.tenant_id) {
      const { data } = await supabase.from("companies").select("id,owner_user_id,status,trial_ends_at,subscription_expires_at").eq("id", profile.tenant_id).is("deleted_at", null).maybeSingle();
      company = data;
    }
    if (!company) {
      const { data } = await supabase.from("companies").select("id,owner_user_id,status,trial_ends_at,subscription_expires_at").eq("owner_user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      company = data;
    }
    if (company && subscriptionIsExpired(company)) {
      const isOwner = company.owner_user_id === user.id;
      if (!isOwner || !request.nextUrl.pathname.startsWith("/dashboard/settings")) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = isOwner ? "/dashboard/settings" : "/connexion";
        redirectUrl.searchParams.set("error", "abonnement_expire");
        return NextResponse.redirect(redirectUrl);
      }
    }
  }
  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*", "/affilie/:path*", "/auth/callback"] };
