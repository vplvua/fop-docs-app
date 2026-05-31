import Link from "next/link";

import {
  ActiveFilters,
  ResetFilters,
  SearchInput,
  type FilterChip,
} from "@/app/components/data-table";

import { buildFilterHref } from "../build-filter-href";

type Params = Record<string, string | undefined>;

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

const SOURCE_LABELS: Record<string, string> = { moeosbb: "Моє ОСББ", local: "Локальні" };
const EDO_LABELS: Record<string, string> = { dubidoc: "Дубідок", vchasno_external: "Вчасно" };
const RESET_KEYS = ["q", "status", "source", "edo"] as const;

/** Removable chips for the currently-applied search + non-default filters. */
function activeChips(params: Params): FilterChip[] {
  const chips: FilterChip[] = [];
  if (params.q) chips.push({ keys: ["q"], label: `Пошук: «${params.q}»` });
  if (params.status === "archive") chips.push({ keys: ["status"], label: "Статус: Архів" });
  if (params.source && SOURCE_LABELS[params.source])
    chips.push({ keys: ["source"], label: `Джерело: ${SOURCE_LABELS[params.source]}` });
  if (params.edo && EDO_LABELS[params.edo])
    chips.push({ keys: ["edo"], label: `ЕДО: ${EDO_LABELS[params.edo]}` });
  return chips;
}

export function ClientsToolbar({ params }: { params: Params }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Пошук за назвою, ЄДРПОУ або MoeOSBB id…"
          ariaLabel="Пошук клієнтів"
          className="w-72"
        />
        <StatusFilters params={params} />
        <SourceFilters params={params} />
        <EdoFilters params={params} />
        <ResetFilters keys={RESET_KEYS} />
      </div>
      <ActiveFilters chips={activeChips(params)} />
    </div>
  );
}

function StatusFilters({ params }: { params: Params }) {
  const active = params.status;
  return (
    <div className="flex gap-1.5">
      <FilterChip
        label="Активні"
        href={buildFilterHref(params, "/clients", "status", null)}
        active={active !== "archive"}
      />
      <FilterChip
        label="Архів"
        href={buildFilterHref(params, "/clients", "status", "archive")}
        active={active === "archive"}
      />
    </div>
  );
}

function SourceFilters({ params }: { params: Params }) {
  const active = params.source;
  return (
    <div className="flex gap-1.5">
      <FilterChip
        label="Усі"
        href={buildFilterHref(params, "/clients", "source", null)}
        active={!active}
      />
      <FilterChip
        label="Моє ОСББ"
        href={buildFilterHref(params, "/clients", "source", "moeosbb")}
        active={active === "moeosbb"}
      />
      <FilterChip
        label="Локальні"
        href={buildFilterHref(params, "/clients", "source", "local")}
        active={active === "local"}
      />
    </div>
  );
}

function EdoFilters({ params }: { params: Params }) {
  const active = params.edo;
  return (
    <div className="flex gap-1.5">
      <FilterChip
        label="Усі ЕДО"
        href={buildFilterHref(params, "/clients", "edo", null)}
        active={!active}
      />
      <FilterChip
        label="Дубідок"
        href={buildFilterHref(params, "/clients", "edo", "dubidoc")}
        active={active === "dubidoc"}
      />
      <FilterChip
        label="Вчасно"
        href={buildFilterHref(params, "/clients", "edo", "vchasno_external")}
        active={active === "vchasno_external"}
      />
    </div>
  );
}
