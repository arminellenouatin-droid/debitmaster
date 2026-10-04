// DebitMaster messages contacts API: Récupère la liste des collègues du tenant courant avec leurs rôles, statuts et compteurs non lus.
import { NextResponse } from "next/server";
import { getAuthorizationContext, can } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { companyHasSpecialOption } from "@/lib/subscription-plans";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const context = await getAuthorizationContext();
    const { user, tenantIds } = context;

    if (!user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    if (!can(context, "messages.view")) {
      return NextResponse.json({ error: "Permission insuffisante pour consulter la messagerie." }, { status: 403 });
    }
    if (!tenantId || !tenantIds.includes(tenantId)) {
      return NextResponse.json({ error: "Établissement non autorisé." }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // 1. Récupération de l'établissement
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id, name, owner_user_id, subscription_plan, activity_type")
      .eq("id", tenantId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });
    }

    const hasSpecialOption = companyHasSpecialOption(company);

    // 2. Récupération des employés actifs de l'établissement
    const { data: employees } = await admin
      .from("employees")
      .select("id, user_id, first_name, last_name, position, phone, status, last_seen_at")
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .is("deleted_at", null);

    // Collecter tous les user_ids pertinents (employés + propriétaire)
    const userIds = new Set<string>();
    if (company.owner_user_id) userIds.add(company.owner_user_id);
    for (const emp of employees ?? []) {
      if (emp.user_id) userIds.add(emp.user_id);
    }
    userIds.add(user.id);

    // 3. Récupération des profils correspondants
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, first_name, last_name, role, avatar_path, phone, last_seen_at")
      .in("id", Array.from(userIds));

    const profilesById = new Map<string, (typeof profiles extends (infer T)[] | null ? T : never)>();
    for (const p of profiles ?? []) {
      if (p?.id) profilesById.set(p.id, p);
    }

    // 4. Compteurs de messages non lus pour l'utilisateur courant par expéditeur
    const { data: unreadRows } = await admin
      .from("internal_messages")
      .select("sender_user_id")
      .eq("tenant_id", tenantId)
      .eq("recipient_user_id", user.id)
      .is("read_at", null);

    const unreadCountBySender = new Map<string, number>();
    for (const row of unreadRows ?? []) {
      if (row.sender_user_id) {
        unreadCountBySender.set(row.sender_user_id, (unreadCountBySender.get(row.sender_user_id) ?? 0) + 1);
      }
    }

    // Unread pour le canal équipe (messages où recipient_user_id is null et sender != user.id)
    const { count: teamUnreadCount } = await admin
      .from("internal_messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("recipient_user_id", null)
      .neq("sender_user_id", user.id)
      .is("read_at", null);

    // 5. Dernier message pour le canal équipe
    const { data: lastTeamMsg } = await admin
      .from("internal_messages")
      .select("body, message_type, created_at, sender_user_id")
      .eq("tenant_id", tenantId)
      .is("recipient_user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 6. Construire la liste des contacts
    type ContactItem = {
      userId: string;
      displayName: string;
      roleLabel: string;
      position: string;
      phone: string | null;
      avatarUrl: string | null;
      isOwner: boolean;
      unreadCount: number;
      lastSeenAt: string | null;
    };

    const contacts: ContactItem[] = [];

    // Ajouter le promoteur si ce n'est pas l'utilisateur connecté
    if (company.owner_user_id && company.owner_user_id !== user.id) {
      const ownerProfile = profilesById.get(company.owner_user_id);
      const name = [ownerProfile?.first_name, ownerProfile?.last_name].filter(Boolean).join(" ") || "Promoteur";
      contacts.push({
        userId: company.owner_user_id,
        displayName: name,
        roleLabel: "Promoteur (Propriétaire)",
        position: "PROMOTEUR",
        phone: ownerProfile?.phone ?? null,
        avatarUrl: null,
        isOwner: true,
        unreadCount: unreadCountBySender.get(company.owner_user_id) ?? 0,
        lastSeenAt: ownerProfile?.last_seen_at ?? null,
      });
    }

    // Ajouter les employés
    const positionLabels: Record<string, string> = {
      SERVEUR: "Serveuse / Serveur",
      GERANT: "Gérant",
      GESTIONNAIRE_STOCK: "Chargé des inventaires",
      INVENTAIRE: "Chargé des inventaires",
      APPROVISIONNEUR: "Chargé des approvisionnements",
      APPROVISIONNEMENT: "Chargé des approvisionnements",
      COMPTABLE: "Comptable",
      CAISSIER: "Caissier",
      CUISINIER: "Cuisinier",
      AGENT_ENTRETIEN: "Agent d'entretien",
      ADMINISTRATEUR: "Administrateur / Promoteur",
      PROMOTEUR: "Promoteur (Propriétaire)",
    };

    for (const emp of employees ?? []) {
      if (!emp.user_id || emp.user_id === user.id) continue;
      // Ne pas dupliquer si c'est le promoteur déjà ajouté
      if (emp.user_id === company.owner_user_id) continue;

      const prof = profilesById.get(emp.user_id);
      const name = [emp.first_name || prof?.first_name, emp.last_name || prof?.last_name].filter(Boolean).join(" ") || `Membre #${emp.id.slice(0, 4)}`;
      const roleLabel = positionLabels[emp.position] || emp.position;

      contacts.push({
        userId: emp.user_id,
        displayName: name,
        roleLabel,
        position: emp.position,
        phone: emp.phone || prof?.phone || null,
        avatarUrl: null,
        isOwner: false,
        unreadCount: unreadCountBySender.get(emp.user_id) ?? 0,
        lastSeenAt: emp.last_seen_at || prof?.last_seen_at || null,
      });
    }

    // Profil de l'utilisateur courant
    const currentProf = profilesById.get(user.id);
    const currentName = [currentProf?.first_name, currentProf?.last_name].filter(Boolean).join(" ") || "Moi";
    const currentIsOwner = user.id === company.owner_user_id;

    return NextResponse.json({
      companyName: company.name,
      tenantId,
      hasSpecialOption,
      currentUser: {
        id: user.id,
        displayName: currentName,
        isOwner: currentIsOwner,
      },
      teamChannel: {
        id: "team",
        name: `Équipe ${company.name}`,
        unreadCount: teamUnreadCount ?? 0,
        lastMessage: lastTeamMsg ? {
          body: lastTeamMsg.body,
          type: lastTeamMsg.message_type,
          createdAt: lastTeamMsg.created_at,
        } : null,
      },
      contacts,
    });
  } catch (error) {
    console.error("[messages/contacts] Erreur:", error);
    return NextResponse.json({ error: "Impossible de charger les contacts." }, { status: 500 });
  }
}
