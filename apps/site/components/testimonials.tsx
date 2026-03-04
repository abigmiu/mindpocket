"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useSiteI18n } from "@/lib/site-i18n"

export default function Testimonials() {
  const { t } = useSiteI18n()
  const items = t.testimonials.items

  return (
    <section className="py-16 md:py-32">
      <div className="mx-auto max-w-6xl space-y-8 px-6 md:space-y-16">
        <div className="relative z-10 mx-auto max-w-xl space-y-6 text-center md:space-y-12">
          <h2 className="text-4xl font-medium lg:text-5xl">{t.testimonials.title}</h2>
          <p>{t.testimonials.subtitle}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-rows-2">
          <Card className="grid grid-rows-[auto_1fr] gap-8 sm:col-span-2 sm:p-6 lg:row-span-2">
            <CardHeader>
              <p className="text-sm font-medium text-muted-foreground">MindPocket</p>
            </CardHeader>
            <CardContent>
              <blockquote className="grid h-full grid-rows-[1fr_auto] gap-6">
                <p className="text-xl font-medium">{items[0].text}</p>
                <Author name={items[0].name} role={items[0].role} />
              </blockquote>
            </CardContent>
          </Card>

          <TestimonialCard text={items[1].text} name={items[1].name} role={items[1].role} />
          <TestimonialCard text={items[2].text} name={items[2].name} role={items[2].role} />
          <TestimonialCard text={items[3].text} name={items[3].name} role={items[3].role} />
        </div>
      </div>
    </section>
  )
}

function TestimonialCard({ text, name, role }: { text: string; name: string; role: string }) {
  return (
    <Card>
      <CardContent className="grid h-full grid-rows-[1fr_auto] gap-6 pt-6">
        <p>{text}</p>
        <Author name={name} role={role} />
      </CardContent>
    </Card>
  )
}

function Author({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3">
      <Avatar className="size-12">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div>
        <cite className="text-sm font-medium">{name}</cite>
        <span className="text-muted-foreground block text-sm">{role}</span>
      </div>
    </div>
  )
}
