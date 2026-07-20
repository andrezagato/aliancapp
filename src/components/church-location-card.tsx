"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { definirLocalIgreja } from "@/lib/actions";
import { getCoords } from "@/lib/geo-client";
import type { ChurchLocation } from "@/lib/data";

const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Card (admin) pra cadastrar a localização da igreja — usada pelo selo de
 * check-in por GPS. Opcional: sem isso, o check-in funciona normal, só sem selo.
 */
export function ChurchLocationCard({ location }: { location: ChurchLocation | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [lat, setLat] = useState(location?.latitude != null ? String(location.latitude) : "");
  const [lng, setLng] = useState(location?.longitude != null ? String(location.longitude) : "");
  const [radius, setRadius] = useState(String(location?.radiusM ?? 200));
  const [busy, start] = useTransition();

  const useMyLocation = async () => {
    const c = await getCoords();
    if (!c) {
      showToast("Não consegui pegar sua localização (permissão?).");
      return;
    }
    setLat(c.lat.toFixed(6));
    setLng(c.lng.toFixed(6));
    showToast("Localização preenchida — confira e salve.");
  };

  const save = () =>
    start(async () => {
      const la = lat.trim() ? Number(lat) : null;
      const lo = lng.trim() ? Number(lng) : null;
      if ((la !== null && Number.isNaN(la)) || (lo !== null && Number.isNaN(lo))) {
        showToast("Latitude/longitude inválidas.");
        return;
      }
      const r = await definirLocalIgreja(la, lo, Number(radius) || 200);
      if (r.ok) {
        showToast("Local da igreja salvo.");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  return (
    <section>
      <h3 className="mb-2 px-1 text-base font-semibold">Local da igreja (check-in por GPS)</h3>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-[13px] text-muted-foreground">
          Define o ponto e o raio pra confirmar o check-in no local. É opcional — sem isso, o check-in funciona
          normal, só sem o selo.
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          className="press-sm inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"
        >
          <LocateFixed className="size-4" /> Usar minha localização atual
        </button>
        <p className="text-[12px] text-muted-foreground">
          Jeito mais fácil: <b>esteja na igreja</b> e toque no botão acima. Não precisa digitar nada.
        </p>
        <details className="text-[12px] text-muted-foreground">
          <summary className="cursor-pointer">Ou informar manualmente (avançado)</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Latitude</span>
            <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="-23.55" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Longitude</span>
            <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder="-46.63" className={inputCls} />
          </label>
        </div>
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Raio (metros)</span>
            <input value={radius} onChange={(e) => setRadius(e.target.value)} inputMode="numeric" className={inputCls} />
          </label>
        </details>
        <button
          onClick={save}
          disabled={busy}
          className="press h-11 w-full rounded-[13px] bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Salvando…" : "Salvar local"}
        </button>
      </div>
    </section>
  );
}
