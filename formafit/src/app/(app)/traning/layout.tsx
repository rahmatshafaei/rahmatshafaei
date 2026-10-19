import { SectionTabs } from "@/components/layout/app-nav";

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs
        tabs={[
          { href: "/traning", label: "Översikt", exact: true },
          { href: "/traning/program", label: "Program" },
          { href: "/traning/ovningar", label: "Övningar" },
          { href: "/traning/historik", label: "Historik" },
        ]}
      />
      {children}
    </>
  );
}
