import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  Loader2,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Signal,
  TrendingUp,
  Boxes,
  ShoppingCart,
  Sparkles,
  Zap,
  Globe2,
} from "lucide-react";
import { useLang } from "@/LanguageContext";

// ── Types matching the Edge Function response ─────────────────────────
interface CatalogOffer {
  duration_minutes: number;
  duration_label: string;
  provider_price_cents: number;
  provider_price_usd: number;
  sale_price_cents: number;
  sale_price_usd: number;
  sale_price_eur: number;
  count: number;
  is_voip: boolean;
  refundable: boolean;
  renewable: boolean;
  delivery_rate: number;
  delivery_samples: number;
}

interface SpainCatalogResponse {
  success: boolean;
  error?: string;
  detail?: string;
  country: string;
  currency: string;
  offers: CatalogOffer[];
  cached_at: number | null;
  fetched_at: number | null;
  cache_age_seconds: number | null;
  source: "cache" | "live";
}

interface ValidateResponse {
  success: boolean;
  valid?: boolean;
  error?: string;
  offer?: CatalogOffer;
  currency?: string;
}

// ── Constants ─────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 75 * 1000; // 75 seconds — within the 1-2 min range
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function formatPriceEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

function timeAgoShort(seconds: number): string {
  if (seconds < 60) return `hace ${seconds}s`;
  const mins = Math.floor(seconds / 60);
  return `hace ${mins}m`;
}

export function SpainCatalogPage() {
  const { localizedPath } = useLang();
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [source, setSource] = useState<"cache" | "live" | null>(null);
  const [tick, setTick] = useState(0); // forces re-render for "hace Xs"
  const [validatingDuration, setValidatingDuration] = useState<number | null>(null);
  const [validationResult, setValidationResult] = useState<{ ok: boolean; msg: string; offer?: CatalogOffer } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCatalog = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);

    try {
      const url = `${supabaseUrl}/functions/v1/eveses-catalog?action=spain-catalog`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
      });
      const json = (await res.json()) as SpainCatalogResponse;

      if (!json.success) {
        setError(json.error || "Error al cargar el catálogo.");
        setOffers([]);
      } else {
        setOffers(json.offers || []);
        setLastUpdated(json.fetched_at ?? Date.now());
        setCacheAge(json.cache_age_seconds ?? 0);
        setSource(json.source);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError("Error de conexión: " + msg);
      setOffers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Auto-poll every 75 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => fetchCatalog(), POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCatalog]);

  // Tick every second for "hace Xs" display
  useEffect(() => {
    if (lastUpdated === null) return;
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [lastUpdated]);

  // ── Pre-purchase validation (prepared for future checkout) ─────────
  const handleBuy = async (offer: CatalogOffer) => {
    setValidatingDuration(offer.duration_minutes);
    setValidationResult(null);

    try {
      const url = `${supabaseUrl}/functions/v1/eveses-catalog?action=validate-offer&duration=${offer.duration_minutes}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
      });
      const json = (await res.json()) as ValidateResponse;

      if (json.success && json.valid && json.offer) {
        setValidationResult({
          ok: true,
          msg: `Oferta confirmada: ${json.offer.duration_label} por ${formatPriceEur(json.offer.sale_price_cents)} €`,
          offer: json.offer,
        });
        // TODO: future checkout will proceed here with the validated offer
      } else {
        setValidationResult({
          ok: false,
          msg: json.error || "Esta oferta acaba de agotarse. Inténtalo de nuevo.",
        });
        // Refresh catalog since something changed
        fetchCatalog();
      }
    } catch {
      setValidationResult({ ok: false, msg: "Error de conexión. Inténtalo de nuevo." });
    } finally {
      setValidatingDuration(null);
    }
  };

  const secondsSinceUpdate = lastUpdated ? Math.floor((Date.now() - lastUpdated) / 1000) : 0;

  return (
    <div className="min-h-screen w-full max-w-full overflow-hidden pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          to={localizedPath("/")}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Inicio
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
            <Boxes className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Números Privados de España
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-lg mx-auto">
            Números privados en alquiler para recibir SMS de cualquier servicio.
            Catálogo actualizado automáticamente cada 1-2 minutos.
          </p>
        </div>

        {/* Live status bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${source === "live" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">España</span>
                <span className="text-base">🇪🇸</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${source === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700/40 text-zinc-400"}`}>
                  {source === "live" ? "EN VIVO" : "CACHÉ"}
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {lastUpdated ? (
                  <>
                    Actualizado {timeAgoShort(secondsSinceUpdate)}
                    {cacheAge !== null && cacheAge > 0 && (
                      <span className="ml-2 text-zinc-600">· caché de {cacheAge}s</span>
                    )}
                  </>
                ) : (
                  "Cargando..."
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => fetchCatalog(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-emerald-500/40 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar ahora
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-red-400">Error</h3>
              <p className="mt-0.5 text-sm text-zinc-300">{error}</p>
            </div>
          </div>
        )}

        {/* Validation result banner */}
        {validationResult && (
          <div className={`mb-6 flex items-start gap-3 rounded-2xl border p-5 ${validationResult.ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${validationResult.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
              {validationResult.ok ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <div>
              <h3 className={`text-base font-bold ${validationResult.ok ? "text-emerald-400" : "text-amber-400"}`}>
                {validationResult.ok ? "Oferta verificada" : "Oferta no disponible"}
              </h3>
              <p className="mt-0.5 text-sm text-zinc-300">{validationResult.msg}</p>
              {validationResult.ok && (
                <p className="mt-1 text-xs text-zinc-500">
                  El checkout real estará disponible próximamente. Esta validación confirma que la oferta sigue activa.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="mt-3 text-sm text-zinc-400">Consultando catálogo de España...</p>
          </div>
        ) : offers.length === 0 && !error ? (
          /* Empty state */
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
              <Boxes className="h-7 w-7 text-zinc-600" />
            </div>
            <h4 className="mt-4 text-base font-bold text-white">Sin ofertas disponibles</h4>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
              No hay números privados de España que cumplan los criterios (renovable, stock disponible, coste del proveedor menor a $10, duraciones de 7/14/30 días).
            </p>
            <p className="mt-2 text-xs text-zinc-500">El catálogo se actualiza automáticamente. Vuelve a intentarlo en unos minutos.</p>
          </div>
        ) : (
          /* Offers grid */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer, i) => {
              const isValidating = validatingDuration === offer.duration_minutes;
              const isPopular = offer.duration_minutes === 10080; // 7 days = popular

              return (
                <div
                  key={`${offer.duration_minutes}-${i}`}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
                    isPopular
                      ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-zinc-900/30 hover:border-emerald-500/60"
                      : "border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-900/30 hover:border-emerald-500/30"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-950 shadow-md">
                      <Sparkles className="h-3 w-3" />
                      Popular
                    </div>
                  )}

                  {/* Duration */}
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-lg font-bold text-white">{offer.duration_label}</h3>
                  </div>

                  {/* Price */}
                  <div className="mt-4">
                    <div className="text-3xl font-black text-white">
                      {formatPriceEur(offer.sale_price_cents)} €
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      ≈ ${offer.sale_price_usd.toFixed(2)} USD
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${offer.count > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                        {offer.count > 0 ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      </span>
                      Stock: <span className="font-mono font-bold text-emerald-400">{offer.count}</span> números
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                        <RotateCcw className="h-3 w-3" />
                      </span>
                      Renovable
                    </div>
                    {offer.refundable && (
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                          <ShieldCheck className="h-3 w-3" />
                        </span>
                        Reembolsable
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                        <Signal className="h-3 w-3" />
                      </span>
                      {offer.is_voip ? "Número VoIP" : "SIM Real"}
                    </div>
                    {offer.delivery_samples > 0 && (
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                          <TrendingUp className="h-3 w-3" />
                        </span>
                        Tasa de entrega: {(offer.delivery_rate * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  {/* Buy button */}
                  <div className="mt-5 pt-1">
                    <button
                      onClick={() => handleBuy(offer)}
                      disabled={isValidating || offer.count <= 0}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/10 transition-all hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Comprar {formatPriceEur(offer.sale_price_cents)} €
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info section */}
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            <Zap className="h-4 w-4" />
            Cómo funciona
          </div>
          <ul className="space-y-1.5 text-xs text-zinc-400">
            <li>• El catálogo se actualiza automáticamente cada 1-2 minutos desde el servidor.</li>
            <li>• Todos los visitantes comparten la misma caché — no se hacen consultas individuales al proveedor.</li>
            <li>• Solo se muestran ofertas renovables con stock disponible y coste del proveedor menor a $10.</li>
            <li>• Al pulsar "Comprar", se verifica en tiempo real que la oferta siga disponible antes de continuar.</li>
            <li>• Si una oferta se agota, desaparece del catálogo automáticamente.</li>
          </ul>
        </div>

        {/* Diagnostic link */}
        <div className="mt-4 text-center">
          <Link
            to={localizedPath("/eveses-catalog-test")}
            className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
          >
            Página de diagnóstico del catálogo →
          </Link>
        </div>
      </div>
    </div>
  );
}
