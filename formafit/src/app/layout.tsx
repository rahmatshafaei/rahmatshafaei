import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FormaFit – kost, träning och coachning", template: "%s · FormaFit" },
  description:
    "FormaFit samlar kaloriräkning, måltidsplaner, träningsprogram, inköpslistor och en AI-coach i en app.",
  applicationName: "FormaFit",
};

export const viewport: Viewport = {
  themeColor: "#faf8f4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{ classNames: { toast: "!rounded-2xl !border-border !shadow-[var(--shadow-float)] !font-sans" } }}
        />
      </body>
    </html>
  );
}
