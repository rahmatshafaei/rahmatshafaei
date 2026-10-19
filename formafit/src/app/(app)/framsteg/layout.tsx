import { SectionTabs } from "@/components/layout/app-nav";

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs
        tabs={[
          { href: "/framsteg", label: "Översikt", exact: true },
          { href: "/framsteg/matt", label: "Vikt & mått" },
          { href: "/framsteg/foton", label: "Bilder" },
        ]}
      />
      {children}
    </>
  );
}
