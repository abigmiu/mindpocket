"use client"

import { useSiteI18n } from "@/lib/site-i18n"

export default function StatsSection() {
  const { t } = useSiteI18n()

  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
        <div className="relative z-10 mx-auto max-w-xl space-y-6 text-center">
          <h2 className="text-4xl font-medium lg:text-5xl">{t.stats.title}</h2>
          <p>{t.stats.subtitle}</p>
        </div>

        <div className="grid gap-12 divide-y *:text-center md:grid-cols-3 md:gap-2 md:divide-x md:divide-y-0">
          {t.stats.items.map((item) => (
            <div key={item.label} className="space-y-4">
              <div className="text-5xl font-bold">{item.value}</div>
              <p>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
