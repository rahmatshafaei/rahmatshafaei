import { SectionTabs } from "@/components/layout/app-nav";

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs
        tabs={[
          { href: "/mat", label: "Dagbok", exact: true },
          { href: "/mat/planer", label: "Måltidsplaner" },
          { href: "/mat/recept", label: "Recept & måltider" },
          { href: "/mat/inkop", label: "Inköpslistor" },
          { href: "/mat/livsmedel", label: "Livsmedel" },
        ]}
      />
      {children}
    </>
  );
}
