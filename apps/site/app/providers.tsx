"use client"

import { SiteI18nProvider } from "@/lib/site-i18n"

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SiteI18nProvider>{children}</SiteI18nProvider>
}
