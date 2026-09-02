// Menu QR public, Design Read: landing lounge sombre et ambre, accès direct depuis une table, contenu réel chargé côté client après vérification serveur.
import { MenuClient } from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function PublicMenuPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MenuClient token={token} />;
}
