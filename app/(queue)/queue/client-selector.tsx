"use client";

import { useCallback } from "react";

import type { ClientCandidate } from "./types";

function CandidateRow({
  candidate,
  busy,
  pending,
  onLink,
}: {
  candidate: ClientCandidate;
  busy: boolean;
  pending: boolean;
  onLink: (clientId: string) => void;
}) {
  const handleClick = useCallback(() => onLink(candidate.id), [onLink, candidate.id]);
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{candidate.name}</p>
        <p className="text-xs text-muted-foreground">
          Договір: {candidate.contractNumber ?? "—"} · Моє ОСББ: {candidate.moeosbbUserId ?? "—"}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Привʼязка…" : "Привʼязати"}
      </button>
    </li>
  );
}

export function ClientSelector({
  candidates,
  onLink,
  linkingId,
  error,
}: {
  candidates: ClientCandidate[];
  onLink: (clientId: string) => void;
  linkingId: string | null;
  error: string | null;
}) {
  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="space-y-2">
        {candidates.map((c) => (
          <CandidateRow
            key={c.id}
            candidate={c}
            busy={linkingId !== null}
            pending={linkingId === c.id}
            onLink={onLink}
          />
        ))}
      </ul>
    </div>
  );
}
