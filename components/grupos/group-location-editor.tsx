"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { markerIcon, DEFAULT_MAP_CENTER } from "@/components/grupos/leaflet-icon";
import { MapResizeFix } from "@/components/grupos/map-resize-fix";
import { Button } from "@/components/ui/Button";
import { updateGroupLocationAction, clearGroupLocationAction } from "@/app/actions/group-location";
import { geocodeAddressAction } from "@/app/actions/geocode";

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Clique e arraste já deixam o pino visível sem precisar mexer na
// câmera (o clique só acontece dentro do que já está na tela). Uma busca
// por endereço é diferente: o resultado pode estar longe de onde o mapa
// está centrado agora, então esse componente move a câmera só quando
// `target` muda — ou seja, só depois de uma busca com sucesso.
function FlyToOnSearch({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return null;
}

export function GroupLocationEditor({
  groupId,
  initialLatitude,
  initialLongitude,
  address,
  editAddressHref,
  readOnly = false,
}: {
  groupId: string;
  initialLatitude: number | null;
  initialLongitude: number | null;
  // Endereço já cadastrado na ficha do grupo (campo "Endereço" + "Região"
  // do GroupForm) — a única fonte do endereço. Esta tela não tem um campo
  // de endereço próprio: seria a mesma informação duplicada em dois
  // lugares, arriscando ficar cada um com um valor diferente. Aqui só se
  // usa esse endereço para posicionar o pino; para corrigi-lo, edita-se a
  // ficha do café.
  address: string;
  // Link para editar o endereço na ficha do café — só passado quando a
  // pessoa logada tem acesso a essa tela (hoje, só admin/desenvolvedora;
  // a líder não tem uma tela própria para isso ainda).
  editAddressHref?: string;
  // Café de outra líder: desde que a liderança passou a enxergar todos os
  // cafés, esta tela também abre para café que não é seu. Aí ela vira só
  // consulta — sem clique no mapa, sem arrastar o pino e sem os botões de
  // salvar/remover. A RLS (`groups_leader_update`) já recusaria a escrita;
  // isto evita oferecer na tela um botão que só levaria a erro.
  readOnly?: boolean;
}) {
  const [position, setPosition] = useState<[number, number] | null>(
    initialLatitude != null && initialLongitude != null ? [initialLatitude, initialLongitude] : null,
  );
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [autoTried, setAutoTried] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  async function handleGeocode() {
    const termo = address.trim();
    if (!termo) {
      setGeocodeError("Este café ainda não tem endereço cadastrado.");
      return;
    }
    setGeocoding(true);
    setGeocodeError(null);
    setSuccess(false);
    const result = await geocodeAddressAction(termo);
    setGeocoding(false);
    if ("error" in result) {
      setGeocodeError(result.error);
      return;
    }
    const found: [number, number] = [result.latitude, result.longitude];
    setPosition(found);
    setFlyTarget(found);
  }

  // Se o grupo já tem um endereço cadastrado e ainda não tem pino no mapa,
  // busca automaticamente assim que a tela abre — a pessoa só precisa
  // corrigir manualmente se o resultado vier impreciso.
  useEffect(() => {
    if (readOnly || autoTried || position || !address.trim()) return;
    // Busca inicial única, disparada na montagem: o efeito é o gatilho aqui.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoTried(true);
    handleGeocode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!position) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    const result = await updateGroupLocationAction(groupId, position[0], position[1]);
    setSaving(false);
    if (result?.error) setError(result.error);
    else setSuccess(true);
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    setSuccess(false);
    const result = await clearGroupLocationAction(groupId);
    setRemoving(false);
    if (result?.error) setError(result.error);
    else setPosition(null);
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError("Seu navegador não suporta geolocalização.");
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
      () => setError("Não foi possível obter sua localização atual."),
    );
  }

  const center = position ?? DEFAULT_MAP_CENTER;
  const temEndereco = address.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Endereço cadastrado</p>
          {temEndereco ? (
            <p className="truncate text-sm text-foreground">{address}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado ainda.</p>
          )}
          {editAddressHref && (
            <Link href={editAddressHref} className="text-xs font-medium text-primary hover:underline">
              {temEndereco ? "Corrigir endereço na ficha do café" : "Cadastrar endereço na ficha do café"}
            </Link>
          )}
        </div>
        {readOnly ? (
          position && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${position[0]},${position[1]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-primary hover:bg-muted"
            >
              Como chegar
            </a>
          )
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={handleGeocode}
            disabled={geocoding || !temEndereco}
            className="shrink-0"
          >
            {geocoding ? "Buscando..." : "Marcar pelo endereço"}
          </Button>
        )}
      </div>
      {geocodeError && <p className="text-sm text-danger">{geocodeError}</p>}

      <p className="text-sm text-muted-foreground">
        {readOnly
          ? "Este café é de outra líder — aqui você só consulta onde ele acontece."
          : temEndereco
            ? "O pino é marcado automaticamente pelo endereço cadastrado. Se o resultado não vier exato, arraste o pino ou clique no mapa para ajustar."
            : "Cadastre um endereço na ficha do café para marcar o pino automaticamente, ou clique no mapa para marcar manualmente."}
      </p>

      <div className="h-[360px] overflow-hidden rounded-2xl border border-border">
        <MapContainer center={center} zoom={position ? 15 : 10} scrollWheelZoom className="h-full w-full">
          <MapResizeFix />
          <FlyToOnSearch target={flyTarget} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && <ClickHandler onPick={(lat, lng) => setPosition([lat, lng])} />}
          {position && (
            <Marker
              position={position}
              icon={markerIcon}
              draggable={!readOnly}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target as LeafletMarker;
                  const latlng = marker.getLatLng();
                  setPosition([latlng.lat, latlng.lng]);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {!readOnly && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {position
                ? `Lat ${position[0].toFixed(6)}, Lng ${position[1].toFixed(6)}`
                : "Nenhuma localização definida ainda."}
            </span>
            <Button type="button" variant="secondary" onClick={handleUseMyLocation}>
              Usar minha localização atual
            </Button>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-primary">Localização salva.</p>}

          <div className="flex gap-2">
            <Button type="button" onClick={handleSave} disabled={!position || saving}>
              {saving ? "Salvando..." : "Salvar localização"}
            </Button>
            {position && (
              <Button type="button" variant="secondary" onClick={handleRemove} disabled={removing}>
                {removing ? "Removendo..." : "Remover localização"}
              </Button>
            )}
          </div>
        </>
      )}

      {readOnly && !position && (
        <p className="text-sm text-muted-foreground">
          Este café ainda não tem o ponto marcado no mapa.
        </p>
      )}
    </div>
  );
}
