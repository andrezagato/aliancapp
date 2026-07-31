"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui/toast";
import { AddressSearch } from "@/components/address-search";
import { ResponsavelControls } from "@/components/responsavel-controls";
import { getCoords } from "@/lib/geo-client";
import { warm } from "@/lib/toasts";
import { atualizarEvento, arquivarEvento, excluirEvento } from "@/lib/actions";
import { fmtTime, churchDateISO } from "@/lib/format";

const inputCls = "w-full rounded-[12px] border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

type Profile = { id: string; name: string; avatarUrl: string | null };

/**
 * Sheet "Gerenciar culto" (admin) — abre POR CIMA do modal da escala (não sai
 * dele). Edita data/hora/local/chegada, define responsável e arquiva/exclui.
 */
export function GerenciarEventoSheet({
  open,
  onClose,
  onChanged,
  onDeleted,
  eventId,
  startsAt,
  endsAt,
  callTimeIso,
  location,
  lat,
  lng,
  churchLat,
  churchLng,
  archived,
  isResponsible,
  responsibleName,
  confirmedAt,
  profiles,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  eventId: string;
  startsAt: string;
  endsAt: string | null;
  callTimeIso: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  churchLat: number | null;
  churchLng: number | null;
  archived: boolean;
  isResponsible: boolean;
  responsibleName: string | null;
  confirmedAt: string | null;
  profiles: Profile[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, start] = useTransition();

  const [date, setDate] = useState(churchDateISO(startsAt));
  const [time, setTime] = useState(fmtTime(startsAt));
  const [endTime, setEndTime] = useState(endsAt ? fmtTime(endsAt) : "");
  const [call, setCall] = useState(callTimeIso ? fmtTime(callTimeIso) : "");
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
        showToast(warm("salvo"));
        onChanged();
      } else {
        showToast(r.error);
      }
    });

  const toggleArchive = () =>
    start(async () => {
      const r = await arquivarEvento(eventId, !archived);
      if (r.ok) {
        showToast(warm(archived ? "eventoReativado" : "eventoArquivado"));
        onChanged();
      } else {
        showToast(r.error);
      }
    });

  const del = () =>
    start(async () => {
      const r = await excluirEvento(eventId);
      if (r.ok) {
        showToast(warm("eventoExcluido"));
        onDeleted();
        router.push("/escalas");
        router.refresh();
      } else {
        showToast(r.error);
      }
    });

  return (
    <Modal open={open} onClose={() => !busy && onClose()} sheet title="Gerenciar culto">
      <div className="mt-1 space-y-4">
        <ResponsavelControls
          eventId={eventId}
          isAdmin
          isResponsible={isResponsible}
          responsibleName={responsibleName}
          confirmedAt={confirmedAt}
          profiles={profiles}
        />

        <div className="space-y-3 border-t border-border/60 pt-3">
          <p className="text-sm font-semibold">Editar culto</p>
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
            {busy ? "Salvando…" : "Salvar culto"}
          </button>
        </div>

        <div className="flex gap-2 border-t border-border/60 pt-3">
          <button
            onClick={() => window.confirm(archived ? "Reativar este evento?" : "Arquivar este evento?") && toggleArchive()}
            disabled={busy}
            className="press-sm inline-flex flex-1 items-center justify-center gap-1.5 rounded-[13px] border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-60"
          >
            {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {archived ? "Reativar" : "Arquivar"}
          </button>
          <button
            onClick={() => window.confirm("Excluir o evento de vez? Não dá pra desfazer.") && del()}
            disabled={busy}
            className="press-sm inline-flex flex-1 items-center justify-center gap-1.5 rounded-[13px] border border-destructive/30 py-2.5 text-sm font-semibold text-destructive-ink disabled:opacity-60"
          >
            <Trash2 className="size-4" /> Excluir
          </button>
        </div>
      </div>
    </Modal>
  );
}
