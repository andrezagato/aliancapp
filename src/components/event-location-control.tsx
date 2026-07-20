"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { AddressSearch } from "@/components/address-search";
import { getCoords } from "@/lib/geo-client";
import { definirLocalEvento } from "@/lib/actions";

const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Local próprio do evento (admin) — override do local da igreja pro selo de
 * check-in. Útil pra eventos fora (retiro). Vazio = usa o local da igreja.
 */
export function EventLocationControl({ eventId, lat, lng }: { eventId: string; lat: number | null; lng: number | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [la, setLa] = useState(lat != null ? String(lat) : "");
  const [lo, setLo] = useState(lng != null ? String(lng) : "");
  const [busy, start] = useTransition();
  const has = lat != null && lng != null;

  const useMy = async () => {
    const c = await getCoords();
    if (!c) {
      showToast("Não consegui pegar a localização (permissão?).");
      return;
    }
    setLa(c.lat.toFixed(6));
    setLo(c.lng.toFixed(6));
    showToast("Coordenada preenchida — salve.");
  };

  const save = () =>
    start(async () => {
      const laN = la.trim() ? Number(la) : null;
      const loN = lo.trim() ? Number(lo) : null;
      if ((laN !== null && Number.isNaN(laN)) || (loN !== null && Number.isNaN(loN))) {
        showToast("Coordenadas inválidas.");
        return;
      }
      const r = await definirLocalEvento(eventId, laN, loN);
      if (r.ok) {
        showToast("Local do evento salvo.");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  const clear = () =>
    start(async () => {
      const r = await definirLocalEvento(eventId, null, null);
      if (r.ok) {
        setLa("");
        setLo("");
        showToast("Local removido — o evento passa a usar o local da igreja.");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 font-semibold">
          <MapPin className="size-4 text-primary" /> Local do evento (GPS)
        </p>
        {has ? (
          <span className="text-[11px] font-bold text-success">definido</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">usa o da igreja</span>
        )}
      </div>
      <p className="text-[13px] text-muted-foreground">
        Só se for fora da igreja (ex.: retiro). Vazio = usa o local da igreja pro check-in. Busque o endereço ou pegue no
        GPS estando lá.
      </p>
      <button
        type="button"
        onClick={useMy}
        className="press-sm inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"
      >
        <LocateFixed className="size-4" /> Usar minha localização atual
      </button>
      <AddressSearch
        onPick={(a, o) => {
          setLa(a.toFixed(6));
          setLo(o.toFixed(6));
        }}
      />
      <details className="text-[12px] text-muted-foreground">
        <summary className="cursor-pointer">Coordenadas (avançado)</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input value={la} onChange={(e) => setLa(e.target.value)} inputMode="decimal" placeholder="latitude" className={inputCls} />
          <input value={lo} onChange={(e) => setLo(e.target.value)} inputMode="decimal" placeholder="longitude" className={inputCls} />
        </div>
      </details>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="press h-10 flex-1 rounded-[12px] bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Salvando…" : "Salvar local do evento"}
        </button>
        {has ? (
          <button
            onClick={clear}
            disabled={busy}
            aria-label="Remover local do evento"
            className="press-sm inline-flex items-center rounded-[12px] border border-border px-3 text-sm font-semibold text-muted-foreground disabled:opacity-60"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </Card>
  );
}
