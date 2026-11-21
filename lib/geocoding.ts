import "server-only";

// Geocodifica um endereço em coordenadas usando o Nominatim (OpenStreetMap) —
// mesma fonte de mapas que a tela de localização já usa, sem depender de uma
// chave paga do Google. Usado tanto na criação/edição do café (geocodifica
// sozinho ao salvar o endereço) quanto no botão "Marcar pelo endereço" da
// tela de localização (ver app/actions/geocode.ts).
//
// Fica em `lib`, não em `app/actions`, porque `lib/services/groups.service.ts`
// também precisa chamar isso ao salvar o grupo — e serviço não deve depender
// de Server Action (a dependência é sempre na outra direção neste projeto).
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "CafeComDeusShine/1.0 (app de gestao de grupos de uma comunidade crista)";

export type GeocodeResult =
  | { latitude: number; longitude: number; displayName: string }
  | { error: string };

export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  const termo = query.trim();
  if (!termo) return { error: "Informe um endereço para buscar." };

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("q", termo);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
      // Busca de endereço é sempre sob demanda — nunca faz sentido cachear
      // entre pessoas ou entre buscas diferentes.
      cache: "no-store",
    });
  } catch (e) {
    console.error("[geocode.fetch]", e);
    return { error: "Não foi possível buscar o endereço agora. Marque manualmente no mapa." };
  }

  if (!response.ok) {
    console.error("[geocode.status]", response.status);
    return { error: "Não foi possível buscar o endereço agora. Marque manualmente no mapa." };
  }

  const results = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  const first = results[0];
  if (!first) {
    return { error: "Endereço não encontrado. Ajuste o texto ou marque manualmente no mapa." };
  }

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { error: "Endereço não encontrado. Ajuste o texto ou marque manualmente no mapa." };
  }

  return { latitude, longitude, displayName: first.display_name };
}
