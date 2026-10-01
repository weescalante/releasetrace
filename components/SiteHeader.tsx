"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    label: "Leak Detections",
    href: "/leak-detections",
  },
  {
    label: "Movies",
    href: "/movies",
  },
  {
    label: "TV Shows",
    href: "/tv-shows",
  },
  {
    label: "Release Calendar",
    href: "/calendar",
  },
];

export default function SiteHeader() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/leak-detections") {
      return pathname === "/leak-detections";
    }

    return pathname.startsWith(href);
  }

  return (
    <header className="border-b border-zinc-900">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
        <Link
          href="/leak-detections"
          className="text-xl font-bold tracking-tight text-white"
        >
          Watch Leaks
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          {navigation.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "font-medium text-white"
                    : "text-zinc-500 transition hover:text-white"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}