import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import { signedUrls } from "@/lib/services/storage";
import { PhotoGallery } from "./photo-gallery";

export const metadata: Metadata = { title: "Framstegsbilder" };

export default async function PhotosPage() {
  const auth = await requireAuth();
  const { data } = await auth.supabase.from("progress_photos").select("*").eq("user_id", auth.userId).order("taken_on", { ascending: false });
  const photos = data ?? [];
  // Signed URLs expire after 30 minutes; photos are never publicly accessible.
  const urls = await signedUrls(auth, "progress-photos", photos.map((p) => p.storage_path), 1800);
  return (
    <>
      <PageHeader title="Framstegsbilder" description="Bilderna är privata och visas bara för dig via tidsbegränsade länkar." />
      <PhotoGallery today={todayIso()} photos={photos.map((p) => ({ id: p.id, takenOn: p.taken_on, pose: p.pose, notes: p.notes, url: urls.get(p.storage_path) ?? null }))} />
    </>
  );
}
