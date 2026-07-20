"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { buscarEndereco } from "@/lib/actions";

/** Busca um endereço (OpenStreetMap) e devolve as coordenadas ao pai. */
export function AddressSearch({ onPick }: { onPick: (lat: number, lng: number, label: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[] | null>(null);
  const [busy, start] = useTransition();

  const search = () =>
    start(async () => {
      setResults(await buscarEndereco(q));
    });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (q.trim().length >= 3) search();
            }
          }}
          placeholder="Buscar endereço (rua, cidade…)"
          className="w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={search}
          disabled={busy || q.trim().length < 3}
          className="press-sm inline-flex shrink-0 items-center gap-1.5 rounded-[12px] border border-border px-3 text-sm font-bold text-primary disabled:opacity-50"
        >
          <Search className="size-4" /> {busy ? "…" : "Buscar"}
        </button>
      </div>
      {results ? (
        results.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Nada encontrado — tente ser mais específico.</p>
        ) : (
          <ul className="max-h-44 overflow-y-auto rounded-[12px] border border-border">
            {results.map((r, i) => (
              <li key={i} className="border-b border-border/60 last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    onPick(r.lat, r.lng, r.label);
                    setResults(null);
                    setQ(r.label);
                  }}
                  className="press-sm block w-full px-3 py-2 text-left text-[13px] hover:bg-muted"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
