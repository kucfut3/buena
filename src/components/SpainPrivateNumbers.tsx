import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Loader2,
  XCircle,
  CheckCircle2,
  RotateCcw,
  Boxes,
  ShoppingCart,
  Sparkles,
  RefreshCw,
  Globe2,
  TrendingUp,
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
  sale_price_eur_cents: number;
  sale_price_eur: number;
  count: number;
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

const POLL_INTERVAL_MS = 75 * 1000;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function timeAgoShort(seconds: number): string {
  if (seconds < 60) return `hace ${seconds}s`;
  const mins = Math.floor(seconds / 60);
  return `hace ${mins}m`;
}

export function SpainPrivateNumbers() {
  const { localizedPath } = useLang();
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [source, setSource] = useState<"cache" | "live" | null>(null);
  const [, setTick] = useState(0);
  const [validatingDuration, setValidatingDuration] = useState<number | null>(null);
  const [validationResult, setValidationResult] = useState<{ ok: boolean; msg: string } | null>(null);

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
        setSource(json.source);
      }
    } catch {
      setError("Error de conexión con el servidor.");
      setOffers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    pollRef.current = setInterval(() => fetchCatalog(), POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCatalog]);

  useEffect(() => {
    if (lastUpdated === null) return;
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [lastUpdated]);

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
          msg: `Oferta confirmada: ${json.offer.duration_label} por ${json.offer.sale_price_eur.toFixed(2)} €`,
        });
      } else {
        setValidationResult({
          ok: false,
          msg: json.error || "Esta oferta acaba de agotarse. Inténtalo de nuevo.",
        });
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
    <section className="w-full max-w-full overflow-hidden py-6">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <Boxes className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white sm:text-3xl">
                    Números Privados de España
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Números privados renovables para recibir SMS de cualquier servicio
                  </p>
                </div>
              </div>
            </div>

            {/* Live status + refresh */}
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${source === "live" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />}
              </div>
              <div className="text-xs">
                <span className="font-bold text-white">🇪🇸 España</span>
                <span className="ml-2 text-zinc-500">
                  {lastUpdated ? `Actualizado ${timeAgoShort(secondsSinceUpdate)}` : "Cargando..."}
                </span>
              </div>
              <button
                onClick={() => fetchCatalog(true)}
                disabled={refreshing}
                className="ml-1 flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:border-emerald-500/40 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Validation result */}
        {validationResult && (
          <div className={`mb-4 flex items-center gap-3 rounded-xl border p-3.5 ${validationResult.ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${validationResult.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
              {validationResult.ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
            <p className="text-sm text-zinc-200">{validationResult.msg}</p>
            <button
              onClick={() => setValidationResult(null)}
              className="ml-auto text-xs text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <XCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
            <p className="text-sm text-zinc-300">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="h-6 w-24 rounded bg-zinc-800" />
                <div className="mt-4 h-8 w-20 rounded bg-zinc-800" />
                <div className="mt-4 h-4 w-32 rounded bg-zinc-800/40" />
                <div className="mt-4 h-9 w-full rounded-lg bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : offers.length === 0 && !error ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-16 text-center">
            <Boxes className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-4 text-sm text-zinc-400">Sin ofertas disponibles en este momento.</p>
            <p className="mt-1 text-xs text-zinc-500">El catálogo se actualiza automáticamente. Vuelve a intentarlo en unos minutos.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {offers.map((offer, i) => {
              const isValidating = validatingDuration === offer.duration_minutes;
              const isPopular = offer.duration_minutes === 10080;

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
                      {offer.sale_price_eur.toFixed(2)} €
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      ≈ ${offer.sale_price_usd.toFixed(2)} USD
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mt-4 space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                      Disponible
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                        <RotateCcw className="h-3 w-3" />
                      </span>
                      Renovable
                    </div>
                    {offer.delivery_samples > 0 && (
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                          <TrendingUp className="h-3 w-3" />
                        </span>
                        Entrega: {(offer.delivery_rate * 100).toFixed(0)}%
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
                          Comprar {offer.sale_price_eur.toFixed(2)} €
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Link to full catalog */}
        <div className="mt-6 text-center">
          <Link
            to={localizedPath("/spain-numbers")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
          >
            Ver catálogo completo de España →
          </Link>
        </div>
      </div>
    </section>
  );
}
