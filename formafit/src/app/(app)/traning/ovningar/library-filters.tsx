"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExerciseFilters } from "@/components/workout/exercise-picker";

export function LibraryFilters({ q, muscle, equipment }: { q: string; muscle: string; equipment: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({ q, muscle, equipment });
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (state.q) params.set("q", state.q);
      if (state.muscle) params.set("muskel", state.muscle);
      if (state.equipment) params.set("utrustning", state.equipment);
      const next = `${pathname}${params.size ? `?${params}` : ""}`;
      router.replace(next, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [state, pathname, router]);
  return <ExerciseFilters {...state} onChange={setState} />;
}
