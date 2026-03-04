"use client"

import Link from "next/link"
import { Logo } from "@/components/logo"
import { useSiteI18n } from "@/lib/site-i18n"

export default function FooterSection() {
  const { t } = useSiteI18n()

  const links = t.footer.links.map((title) => ({ title, href: "#" }))

  return (
    <footer className="py-16 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <Link href="/" aria-label="go home" className="mx-auto block size-fit">
          <Logo />
        </Link>

        <div className="my-8 flex flex-wrap justify-center gap-6 text-sm">
          {links.map((link) => (
            <Link
              key={link.title}
              href={link.href}
              className="text-muted-foreground hover:text-primary block duration-150"
            >
              <span>{link.title}</span>
            </Link>
          ))}
        </div>

        <span className="text-muted-foreground block text-center text-sm">
          © {new Date().getFullYear()} {t.footer.copyright}
        </span>
      </div>
    </footer>
  )
}
