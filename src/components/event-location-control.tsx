"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin } from "lucide-react";
import { Modal } from "@/components/modal";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { AddressSearch } from "@/components/address-search";
import { getCoords } from "@/lib/geo-client";
import { definirLocalEvento } from "@/lib/actions";

const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Card compacto "Local do evento" (admin). Toca em Definir/Editar → modal com
 * GPS / busca de endereço / manual. Vazio = usa o local da igreja pro selo de
 * check-in; os campos já vêm pré-populados com o endereço da igreja pra ajustar.
 */
export function EventLocationControl({
  eventId,
  lat,
  lng,
  churchLat,
  churchLng,
}: {
  eventId: string;
  lat: number | null;
  lng: number | null;
  churchLat: number | null;
  churchLng: number | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const has = lat != null && lng != null;
  const seedLat = lat ?? churchLat;
  const seedLng = lng ?? churchLng;
  const [la, setLa] = useState(seedLat != null ? String(seedLat) : "");
  const [lo, setLo] = useState(seedLng != null ? String(seedLng) : "");

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
        setOpen(false);
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  const clear = () =>
    start(async () => {
      const r = await definirLocalEvento(eventId, null, null);
      if (r.ok) {
        setLa(churchLat != null ? String(churchLat) : "");
        setLo(churchLng != null ? String(churchLng) : "");
        showToast("Local removido — o evento usa o local da igreja.");
        setOpen(false);
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <MapPin className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Local do evento</p>
          <p className="text-[12.5px] text-muted-foreground">{has ? "Local próprio (GPS)" : "Usa o local da igreja"}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="press-sm shrink-0 rounded-full border border-border px-3 py-1.5 text-[13px] font-bold text-primary"
        >
          {has ? "Editar" : "Definir"}
        </button>
      </div>

      <Modal open={open} onClose={() => !busy && setOpen(false)} sheet title="Local do evento">
        <div className="mt-1 space-y-3">
          <p className="text-[13px] text-muted-foreground">
            Só se for fora da igreja (ex.: retiro). Já vem com o endereço da igreja — ajuste o que precisar. Vazio =
            usa o local da igreja pro check-in.
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
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={busy}
              className="press h-11 flex-1 rounded-[13px] bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Salvando…" : "Salvar local"}
            </button>
            {has ? (
              <button
                onClick={clear}
                disabled={busy}
                className="press-sm rounded-[13px] border border-border px-3 text-sm font-semibold text-muted-foreground disabled:opacity-60"
              >
                Remover
              </button>
            ) : null}
          </div>
        </div>
      </Modal>
    </Card>
  );
}
