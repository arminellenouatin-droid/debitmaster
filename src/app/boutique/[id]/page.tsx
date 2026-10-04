import { redirect } from "next/navigation";

export default async function BoutiqueRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/vitrine/${id}`);
}
