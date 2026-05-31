"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { recallQuery, rememberQuery } from "@/lib/data-tables/nav-memory";

export interface NavLink {
  href: string;
  label: string;
  /** Persist + restore the last query string for this section. */
  remember?: boolean;
}

function NavLinkItem({ link, queueCount }: { link: NavLink; queueCount: number }) {
  return (
    <>
      {link.label}
      {link.href === "/queue" && queueCount > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
          {queueCount}
        </span>
      ) : null}
    </>
  );
}

const NAV_LINK_CLASS =
  "flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

/**
 * Static nav rendered as the Suspense fallback (and during SSR): bare links with
 * no remembered query. Matches `NavLinks`' pre-hydration output so there is no
 * visual shift when memory hydrates.
 */
export function NavLinksFallback({ links, queueCount }: { links: NavLink[]; queueCount: number }) {
  return (
    <nav className="flex items-center gap-4">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={NAV_LINK_CLASS}>
          <NavLinkItem link={link} queueCount={queueCount} />
        </Link>
      ))}
    </nav>
  );
}

/**
 * Top-nav links with per-section query memory. While the operator is on a
 * `remember` section's list surface, the current query is saved; the link then
 * carries that query, so returning via the menu restores the last applied
 * search/filters instead of a bare list. Memory is read after mount to avoid a
 * hydration mismatch (links render bare on the server, enriched on the client).
 */
export function NavLinks({ links, queueCount }: { links: NavLink[]; queueCount: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [hydrated, setHydrated] = useState(false);

  // Persist the current query for the active section's list surface only
  // (exact match — detail pages must not overwrite the list's remembered query).
  useEffect(() => {
    const active = links.find((link) => link.remember && link.href === pathname);
    if (active) rememberQuery(active.href, search);
    setHydrated(true);
  }, [links, pathname, search]);

  return (
    <nav className="flex items-center gap-4">
      {links.map((link) => {
        const remembered = hydrated && link.remember ? recallQuery(link.href) : "";
        const href = remembered ? `${link.href}?${remembered}` : link.href;
        return (
          <Link key={link.href} href={href} className={NAV_LINK_CLASS}>
            <NavLinkItem link={link} queueCount={queueCount} />
          </Link>
        );
      })}
    </nav>
  );
}
