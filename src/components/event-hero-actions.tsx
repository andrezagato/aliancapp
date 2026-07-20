"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Archive, ArchiveRestore, Trash2, LocateFixed } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { AddressSearch } from "@/components/address-search";
import { getCoords } from "@/lib/geo-client";
import { definirLocalEvento, arquivarEvento, excluirEvento } from "@/lib/actions";

const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";
const heroBtn =
  "press-sm grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 disabled:opacity-60";

/**
 * Ações do admin dentro do cabeçalho (hero) do evento: editar local (nome +
 * GPS/endereço), arquivar/reativar e excluir. Ícones translúcidos sobre o vinho.
 */
export function EventHeroActions({
  eventId,
  archived,
  location,
  lat,
  lng,
  churchLat,
  churchLng,
}: {
  eventId: string;
  archived: boolean;
  location: string | null;
  lat: number | null;
  lng: number | null;
  churchLat: number | null;
  churchLng: number | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, start] = useTransition();
  const [openLoc, setOpenLoc] = useState(false);

  const has = lat != null && lng != null;
  const [name, setName] = useState(location ?? "");
  const [la, setLa] = useState((lat ?? churchLat) != null ? String(lat ?? churchLat) : "");
  const [lo, setLo] = useState((lng ?? churchLng) != null ? String(lng ?? churchLng) : "");

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

  const saveLoc = () =>
    start(async () => {
      const laN = la.trim() ? Number(la) : null;
      const loN = lo.trim() ? Number(lo) : null;
      if ((laN !== null && Number.isNaN(laN)) || (loN !== null && Number.isNaN(loN))) {
        showToast("Coordenadas inválidas.");
        return;
      }
      const r = await definirLocalEvento(eventId, laN, loN, name.trim() || null);
      if (r.ok) {
        showToast("Local salvo.");
        setOpenLoc(false);
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  const clearLoc = () =>
    start(async () => {
      const r = await definirLocalEvento(eventId, null, null, null);
      if (r.ok) {
        setName("");
        setLa(churchLat != null ? String(churchLat) : "");
        setLo(churchLng != null ? String(churchLng) : "");
        showToast("Local removido.");
        setOpenLoc(false);
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  const toggleArchive = () =>
    start(async () => {
      const r = await arquivarEvento(eventId, !archived);
      if (r.ok) {
        showToast(archived ? "Evento reativado." : "Evento arquivado.");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  const del = () =>
    start(async () => {
      const r = await excluirEvento(eventId);
      if (r.ok) {
        showToast("Evento excluído.");
        router.push("/escalas");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  return (
    <div className="absolute right-3 top-3 z-10 flex gap-1.5">
      <button onClick={() => setOpenLoc(true)} aria-label="Editar local" className={heroBtn}>
        <MapPin className="size-[18px]" />
      </button>
      <button
        onClick={() => window.confirm(archived ? "Reativar este evento?" : "Arquivar este evento?") && toggleArchive()}
        disabled={busy}
        aria-label={archived ? "Reativar" : "Arquivar"}
        className={heroBtn}
      >
        {archived ? <ArchiveRestore className="size-[18px]" /> : <Archive className="size-[18px]" />}
      </button>
      <button
        onClick={() => window.confirm("Excluir o evento de vez? Não dá pra desfazer.") && del()}
        disabled={busy}
        aria-label="Excluir"
        className={heroBtn}
      >
        <Trash2 className="size-[18px]" />
      </button>

      <Modal open={openLoc} onClose={() => !busy && setOpenLoc(false)} sheet title="Local do evento">
        <div className="mt-1 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nome do local</span>
            <input className={inputCls} placeholder="Ex.: Templo / Chácara do retiro" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="text-[13px] text-muted-foreground">
            O GPS abaixo é pro selo de check-in — só preenche se for fora da igreja. Buscar o endereço já preenche o
            nome e o ponto.
          </p>
          <button
            type="button"
            onClick={useMy}
            className="press-sm inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"
          >
            <LocateFixed className="size-4" /> Usar minha localização atual
          </button>
          <AddressSearch
            onPick={(a, o, label) => {
              setLa(a.toFixed(6));
              setLo(o.toFixed(6));
              if (!name.trim()) setName(label);
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
              onClick={saveLoc}
              disabled={busy}
              className="press h-11 flex-1 rounded-[13px] bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Salvando…" : "Salvar local"}
            </button>
            {has ? (
              <button
                onClick={clearLoc}
                disabled={busy}
                className="press-sm rounded-[13px] border border-border px-3 text-sm font-semibold text-muted-foreground disabled:opacity-60"
              >
                Remover
              </button>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}
