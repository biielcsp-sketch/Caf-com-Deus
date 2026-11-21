"use server";

import { geocodeAddress, type GeocodeResult } from "@/lib/geocoding";

export type { GeocodeResult };

// Usado pelo botão "Marcar pelo endereço" da tela de localização, para
// repetir a busca sob demanda (por exemplo, depois de corrigir o endereço na
// ficha do café). A criação/edição do café já geocodifica sozinha — ver
// lib/services/groups.service.ts.
export async function geocodeAddressAction(query: string): Promise<GeocodeResult> {
  return geocodeAddress(query);
}
