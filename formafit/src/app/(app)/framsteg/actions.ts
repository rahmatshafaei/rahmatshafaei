"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, unwrap, UserFacingError } from "@/lib/actions";
import { isIsoDate } from "@/lib/dates";
import { removeObjects, uploadImage } from "@/lib/services/storage";
import { measurementSchema, uuid } from "@/lib/validation";

function revalidateProgress() {
  revalidatePath("/framsteg", "layout");
  revalidatePath("/hem");
}

export async function saveMeasurement(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const m = measurementSchema.parse(raw);
    unwrap(
      await supabase.from("measurements").upsert(
        {
          user_id: userId,
          measured_on: m.measuredOn,
          weight_kg: m.weightKg ?? null,
          waist_cm: m.waistCm ?? null,
          chest_cm: m.chestCm ?? null,
          hips_cm: m.hipsCm ?? null,
          arm_cm: m.armCm ?? null,
          thigh_cm: m.thighCm ?? null,
          body_fat_pct: m.bodyFatPct ?? null,
          notes: m.notes ?? null,
        },
        { onConflict: "user_id,measured_on" },
      ),
    );
    revalidateProgress();
    return null;
  });
}

/** Quick weigh-in that keeps any other measurements recorded on the same day. */
export async function logWeight(rawDate: unknown, rawWeight: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const date = z.string().refine(isIsoDate, "Ogiltigt datum.").parse(rawDate);
    const weight = z.coerce.number().min(30, "Ange vikt i kg (30–350).").max(350, "Ange vikt i kg (30–350).").parse(String(rawWeight).replace(",", "."));
    const { data: existing } = await supabase.from("measurements").select("id").eq("user_id", userId).eq("measured_on", date).maybeSingle();
    if (existing) unwrap(await supabase.from("measurements").update({ weight_kg: weight }).eq("id", existing.id).eq("user_id", userId));
    else unwrap(await supabase.from("measurements").insert({ user_id: userId, measured_on: date, weight_kg: weight }));
    revalidateProgress();
    return null;
  });
}

export async function deleteMeasurement(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.from("measurements").delete().eq("id", id).eq("user_id", userId));
    revalidateProgress();
    return null;
  });
}

const photoMeta = z.object({
  takenOn: z.string().refine(isIsoDate, "Ogiltigt datum."),
  pose: z.enum(["front", "side", "back", "other"]),
  notes: z.string().trim().max(500).optional(),
});

export async function uploadProgressPhoto(formData: FormData) {
  return authedAction(async (auth) => {
    const meta = photoMeta.parse({ takenOn: formData.get("takenOn"), pose: formData.get("pose"), notes: formData.get("notes") || undefined });
    const path = await uploadImage(auth, "progress-photos", meta.takenOn, formData.get("photo"));
    const { error } = await auth.supabase
      .from("progress_photos")
      .insert({ user_id: auth.userId, taken_on: meta.takenOn, pose: meta.pose, storage_path: path, notes: meta.notes ?? null });
    if (error) {
      await removeObjects(auth, "progress-photos", [path]);
      throw error;
    }
    revalidatePath("/framsteg/foton");
    return null;
  });
}

export async function deleteProgressPhoto(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const photo = unwrap(await auth.supabase.from("progress_photos").select("storage_path").eq("id", id).eq("user_id", auth.userId).maybeSingle());
    if (!photo) throw new UserFacingError("Bilden hittades inte.");
    await removeObjects(auth, "progress-photos", [photo.storage_path]);
    unwrap(await auth.supabase.from("progress_photos").delete().eq("id", id).eq("user_id", auth.userId));
    revalidatePath("/framsteg/foton");
    return null;
  });
}
