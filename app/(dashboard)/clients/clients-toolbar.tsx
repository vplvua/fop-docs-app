"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, type ChangeEvent } from "react";

function buildHref(base: URLSearchParams, key: string, value: string | null): string {
  const sp = new URLSearchParams(base.toString());
  if (value) sp.set(key, value);
  else sp.delete(key);
  return `/clients?${sp.toString()}`;
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </Link>
  );
}

function SearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const sp = new URLSearchParams(searchParams.toString());
      const v = e.target.value.trim();
      if (v) sp.set("q", v);
      else sp.delete("q");
      router.push(`/clients?${sp.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <input
      type="search"
      defaultValue={defaultValue}
      placeholder="Пошук за назвою або ЄДРПОУ…"
      aria-label="Пошук клієнтів"
      className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      onChange={handleChange}
    />
  );
}

interface Params {
  q?: string | undefined;
  status?: string | undefined;
  source?: string | undefined;
  edo?: string | undefined;
}

export function ClientsToolbar({ params }: { params: Params }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.source) sp.set("source", params.source);
  if (params.edo) sp.set("edo", params.edo);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput defaultValue={params.q ?? ""} />
      <StatusFilters sp={sp} active={params.status} />
      <SourceFilters sp={sp} active={params.source} />
      <EdoFilters sp={sp} active={params.edo} />
    </div>
  );
}

function StatusFilters({ sp, active }: { sp: URLSearchParams; active?: string | undefined }) {
  return (
    <div className="flex gap-1.5">
      <FilterChip
        label="Активні"
        href={buildHref(sp, "status", null)}
        active={active !== "archive"}
      />
      <FilterChip
        label="Архів"
        href={buildHref(sp, "status", "archive")}
        active={active === "archive"}
      />
    </div>
  );
}

function SourceFilters({ sp, active }: { sp: URLSearchParams; active?: string | undefined }) {
  return (
    <div className="flex gap-1.5">
      <FilterChip label="Усі" href={buildHref(sp, "source", null)} active={!active} />
      <FilterChip
        label="Моє ОСББ"
        href={buildHref(sp, "source", "moeosbb")}
        active={active === "moeosbb"}
      />
      <FilterChip
        label="Локальні"
        href={buildHref(sp, "source", "local")}
        active={active === "local"}
      />
    </div>
  );
}

function EdoFilters({ sp, active }: { sp: URLSearchParams; active?: string | undefined }) {
  return (
    <div className="flex gap-1.5">
      <FilterChip label="Усі ЕДО" href={buildHref(sp, "edo", null)} active={!active} />
      <FilterChip
        label="Дубідок"
        href={buildHref(sp, "edo", "dubidoc")}
        active={active === "dubidoc"}
      />
      <FilterChip
        label="Вчасно"
        href={buildHref(sp, "edo", "vchasno_external")}
        active={active === "vchasno_external"}
      />
    </div>
  );
}
