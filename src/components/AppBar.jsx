"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTournament } from "@/context/TournamentContext";

const LINKS = [
  { href: "/organization", label: "Organization", match: p => p.startsWith("/organization") || p.startsWith("/play") },
  { href: "/simulation", label: "Major", match: p => p.startsWith("/simulation") },
  { href: "/multiplayer", label: "Multiplayer", match: p => p.startsWith("/multiplayer") || p.startsWith("/room") },
];

export default function AppBar({ children }) {
  const pathname = usePathname() || "";
  const { organization } = useTournament();
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-8 px-4 sm:px-6">
        <Link href="/" prefetch={false} className="shrink-0 text-[15px] font-semibold text-ink">CS Major Simulator</Link>
        <nav aria-label="Main" className="hidden items-center gap-6 sm:flex">
          {LINKS.map(link => {
            const active = link.match(pathname);
            return (
              <Link key={link.href} href={link.href} prefetch={false} aria-current={active ? "page" : undefined}
                className={`transition-colors ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-4">
          {children}
          {organization && !children && (
            <Link href="/organization" prefetch={false} className="flex min-w-0 items-center gap-2 text-ink-2 transition-colors hover:text-ink">
              {/* Crests are generated data URLs. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={organization.icon} alt="" width="20" height="20" />
              <span className="truncate">{organization.name}</span>
            </Link>
          )}
        </div>
      </div>
      <nav aria-label="Main" className="flex gap-6 overflow-x-auto px-4 pb-3 sm:hidden">
        {LINKS.map(link => (
          <Link key={link.href} href={link.href} prefetch={false} aria-current={link.match(pathname) ? "page" : undefined}
            className={link.match(pathname) ? "text-ink" : "text-ink-2"}>{link.label}</Link>
        ))}
      </nav>
    </header>
  );
}
