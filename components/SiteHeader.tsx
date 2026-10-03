"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import {
  usePathname,
} from "next/navigation";

const navigation = [
  {
    label:
      "Leak Detections",

    href:
      "/leak-detections",
  },
  {
    label:
      "Latest Cams",

    href:
      "/latest-cams",
  },
  {
    label:
      "Latest Web",

    href:
      "/latest-web",
  },
  {
    label:
      "Latest Blu-rays",

    href:
      "/latest-blurays",
  },
  {
    label:
      "Movies",

    href:
      "/movies",
  },
  {
    label:
      "TV Shows",

    href:
      "/tv-shows",
  },
  {
    label:
      "Release Calendar",

    href:
      "/calendar",
  },
];

export default function SiteHeader() {
  const pathname =
    usePathname();

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] =
    useState(
      false,
    );

  useEffect(
    () => {
      setMobileMenuOpen(
        false,
      );
    },
    [
      pathname,
    ],
  );

  function isActive(
    href: string,
  ) {
    if (
      href ===
      "/leak-detections"
    ) {
      return (
        pathname ===
        "/leak-detections"
      );
    }

    return pathname.startsWith(
      href,
    );
  }

  return (
    <header className="relative border-b border-zinc-900 bg-black">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-6 px-6 py-5">
        <Link
          href="/leak-detections"
          className="shrink-0 text-xl font-bold tracking-tight text-white"
        >
          Watch Leaks
        </Link>

        <nav className="hidden items-center gap-5 text-xs lg:flex xl:gap-7 xl:text-sm">
          {navigation.map(
            (item) => {
              const active =
                isActive(
                  item.href,
                );

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className={
                    active
                      ? "whitespace-nowrap font-medium text-white"
                      : "whitespace-nowrap text-zinc-500 transition hover:text-white"
                  }
                >
                  {
                    item.label
                  }
                </Link>
              );
            },
          )}
        </nav>

        <button
          type="button"
          aria-expanded={
            mobileMenuOpen
          }
          aria-controls="mobile-site-navigation"
          onClick={
            () =>
              setMobileMenuOpen(
                (
                  current,
                ) =>
                  !current,
              )
          }
          className="inline-flex items-center border border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300 transition hover:border-zinc-600 hover:text-white lg:hidden"
        >
          {mobileMenuOpen
            ? "Close"
            : "Menu"}
        </button>
      </div>

      {mobileMenuOpen && (
        <nav
          id="mobile-site-navigation"
          className="border-t border-zinc-900 bg-black px-6 py-3 lg:hidden"
        >
          <div className="mx-auto grid w-full max-w-[1500px]">
            {navigation.map(
              (item) => {
                const active =
                  isActive(
                    item.href,
                  );

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className={
                      active
                        ? "border-b border-zinc-900 py-3 text-sm font-semibold text-white last:border-b-0"
                        : "border-b border-zinc-900 py-3 text-sm text-zinc-500 transition hover:text-white last:border-b-0"
                    }
                  >
                    {
                      item.label
                    }
                  </Link>
                );
              },
            )}
          </div>
        </nav>
      )}
    </header>
  );
}