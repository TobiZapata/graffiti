import { redirect } from "next/navigation";

export default async function DraftPage({ params }) {
  const { id } = await params;
  redirect(`/room/${encodeURIComponent(id)}`);
}
