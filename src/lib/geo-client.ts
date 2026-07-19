// Pega a localização do aparelho (best-effort). Resolve null se não houver
// suporte, a permissão for negada ou der timeout — o check-in NUNCA depende
// disso (o selo "no local" é só um bônus). Client-only.
export function getCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
    );
  });
}
