import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/inter";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FormaFit – kost, träning och coachning", template: "%s · FormaFit" },
  description:
    "FormaFit samlar kaloriräkning, måltidsplaner, träningsprogram, inköpslistor och en AI-coach i en app.",
  applicationName: "FormaFit",
  appleWebApp: { capable: true, title: "FormaFit", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#121513" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        {/* Applies an explicit theme choice before paint (data-theme is not rendered by React). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <ServiceWorkerRegistrar />
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border-border !bg-surface !text-foreground !shadow-[var(--shadow-float)] !font-sans",
              description: "!text-muted-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
