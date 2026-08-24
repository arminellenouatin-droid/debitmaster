// DebitManager security boundary: rafraîchissement SSR de session et protection des routes privées.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  const { data: profile } = user ? await supabase.from("profiles").select("user_type,role,status").eq("id", user.id).maybeSingle() : { data: null };
  const isPlatformAdmin = (candidate: { user_type?: string | null; role?: string | null; status?: string | null } | null) => candidate?.user_type === "SUPER_ADMIN" && candidate.role === "MASTER_ADMIN" && candidate.status === "ACTIVE";
  if (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/affilie")) {
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
    if (accessRequest && accessRequest.status !== "APPROVED") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/connexion";
      redirectUrl.searchParams.set("error", accessRequest.status === "PENDING" ? "validation_en_attente" : "acces_refuse");
      return NextResponse.redirect(redirectUrl);
    }
  }
  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/auth/callback"] };
