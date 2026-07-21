"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, LocateFixed, Pencil } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { AddressSearch } from "@/components/address-search";
import { getCoords } from "@/lib/geo-client";
import { atualizarEvento } from "@/lib/actions";
import { fmtTime, churchDateISO } from "@/lib/format";

const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Linha de infos do hero do evento (hora · chegada · local). Pro admin, tocar
 * abre o modal "Editar culto" (data/hora/fim/chegada/local/GPS num salvar só).
 * Pros demais, é só leitura — com o local abrindo o mapa.
 */
export function EventHeroInfo({
  eventId,
  canEdit,
  startsAt,
  endsAt,
  callTimeIso,
  location,
  lat,
  lng,
  churchLat,
  churchLng,
}: {
  eventId: string;
  canEdit: boolean;
  startsAt: string;
  endsAt: string | null;
  callTimeIso: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  churchLat: number | null;
  churchLng: number | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();

  const [date, setDate] = useState(churchDateISO(startsAt));
  const [time, setTime] = useState(fmtTime(startsAt));
  const [endTime, setEndTime] = useState(endsAt ? fmtTime(endsAt) : "");
  const [call, setCall] = useState(callTimeIso ? fmtTime(callTimeIso) : "");
  const [name, setName] = useState(location ?? "");
  const [la, setLa] = useState((lat ?? churchLat) != null ? String(lat ?? churchLat) : "");
  const [lo, setLo] = useState((lng ?? churchLng) != null ? String(lng ?? churchLng) : "");

  const timeStr = fmtTime(startsAt) + (endsAt ? ` – ${fmtTime(endsAt)}` : "");
  const mapsHref = location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;

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
      const r = await atualizarEvento(eventId, {
        date,
        time,
        endTime: endTime || undefined,
        callTime: call || undefined,
        location: name,
        lat: laN,
        lng: loN,
      });
      if (r.ok) {
        showToast("Evento atualizado.");
        setOpen(false);
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  // Leitura (voluntário/líder): local abre o mapa.
  if (!canEdit) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13.5px] text-primary-foreground/85">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5 text-accent" /> {timeStr}
        </span>
        {callTimeIso ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-accent">Equipe às {fmtTime(callTimeIso)}</span>
        ) : null}
        {location ? (
          <a href={mapsHref!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">
            <MapPin className="size-3.5 text-accent" /> {location}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press-sm -ml-1 mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg px-1 py-0.5 text-left text-[13.5px] text-primary-foreground/85"
      >
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5 text-accent" /> {timeStr}
        </span>
        {callTimeIso ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-accent">Equipe às {fmtTime(callTimeIso)}</span>
        ) : null}
        {location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 text-accent" /> {location}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 font-semibold text-accent">
          <Pencil className="size-3" /> editar
        </span>
      </button>

      <Modal open={open} onClose={() => !busy && setOpen(false)} sheet title="Editar culto">
        <div className="mt-1 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Data</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Hora</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Término (opcional)</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Chegada da equipe</span>
              <input type="time" value={call} onChange={(e) => setCall(e.target.value)} className={inputCls} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nome do local</span>
            <input className={inputCls} placeholder="Ex.: Templo / Chácara do retiro" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="rounded-[14px] border border-border/70 bg-muted/20 p-3">
            <p className="mb-2 text-[12px] text-muted-foreground">
              Local pro check-in por GPS (opcional). Buscar o endereço já preenche o nome e o ponto.
            </p>
            <button
              type="button"
              onClick={useMy}
              className="press-sm inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"
            >
              <LocateFixed className="size-4" /> Usar minha localização
            </button>
            <div className="mt-2">
              <AddressSearch
                onPick={(a, o, label) => {
                  setLa(a.toFixed(6));
                  setLo(o.toFixed(6));
                  if (!name.trim()) setName(label);
                }}
              />
            </div>
            <details className="mt-2 text-[12px] text-muted-foreground">
              <summary className="cursor-pointer">Coordenadas (avançado)</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input value={la} onChange={(e) => setLa(e.target.value)} inputMode="decimal" placeholder="latitude" className={inputCls} />
                <input value={lo} onChange={(e) => setLo(e.target.value)} inputMode="decimal" placeholder="longitude" className={inputCls} />
              </div>
            </details>
          </div>

          <button
            onClick={save}
            disabled={busy}
            className="press h-[52px] w-full rounded-[15px] bg-primary text-[15.5px] font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
