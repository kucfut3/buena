// Eveses catalog Edge Function — queries the NATIVE REST API for rental pricing.
// Uses Bearer token auth (EVSES_API_KEY). No sms-activate gateway.
// Product: Private Number — Any Service (service=anyother, mode=rent)
//
// Server-side cache: pricing for Spain (es) is cached for 90 seconds.
// All visitors share the same cached response — no per-client Eveses queries.
// A `force` query param bypasses the cache for the diagnostic page.

// ── In-memory cache (resets on cold start) ──────────────────────────────
interface CacheEntry {
  data: unknown;
  fetchedAt: number; // ms epoch
  httpStatus: number;
  ok: boolean;
}

const CACHE_TTL_MS = 90 * 1000; // 90 seconds
const pricingCache = new Map<string, CacheEntry>(); // key = country code

// ── Sale price markup ──────────────────────────────────────────────────
// provider_price is the Eveses cost (in cents). We apply a markup to
// compute sale_price. The markup is configurable but never changes the
// $10 provider cost ceiling.
const SALE_MARKUP_PERCENT = 60; // 60% markup over provider cost

function computeSalePrice(providerPriceCents: number): number {
  return Math.round(providerPriceCents * (1 + SALE_MARKUP_PERCENT / 100));
}

// ── Duration filter: only 7, 14, 30 days (in minutes) ──────────────────
const ALLOWED_DURATIONS_MIN = [10080, 20160, 43200]; // 7d, 14d, 30d
const MAX_PROVIDER_PRICE_CENTS = 1000; // $10.00 in cents

interface DurationOption {
  price: number;
  delivery: number;
  delivery_samples: number;
  count: number;
  is_voip: boolean;
  refundable: boolean;
  renewable: boolean;
}

interface DurationEntry {
  duration: number;
  price: number;
  is_voip: boolean;
  options: DurationOption[];
  count: number;
  refundable: boolean;
  renewable: boolean;
}

interface ServiceEntry {
  name: string;
  label: string;
  geo_advisory: string | null;
  durations: DurationEntry[];
}

interface PricingData {
  mode: string;
  country: string;
  currency: string;
  services: ServiceEntry[];
}

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

function durationLabel(min: number): string {
  if (min >= 43200) return "30 días";
  if (min >= 20160) return "14 días";
  if (min >= 10080) return "7 días";
  return `${min} min`;
}

// USD→EUR approx (static; Eveses prices are in USD)
const USD_TO_EUR = 0.92;

function filterSpainOffers(pricing: PricingData): CatalogOffer[] {
  const service = pricing.services?.find((s) => s.name === "anyother");
  if (!service) return [];

  const offers: CatalogOffer[] = [];

  for (const dur of service.durations) {
    if (!ALLOWED_DURATIONS_MIN.includes(dur.duration)) continue;

    for (const opt of dur.options) {
      if (!opt.renewable) continue;
      if (opt.count <= 0) continue;
      if (opt.price >= MAX_PROVIDER_PRICE_CENTS) continue;

      offers.push({
        duration_minutes: dur.duration,
        duration_label: durationLabel(dur.duration),
        provider_price_cents: opt.price,
        provider_price_usd: opt.price / 100,
        sale_price_cents: computeSalePrice(opt.price),
        sale_price_usd: computeSalePrice(opt.price) / 100,
        sale_price_eur: (computeSalePrice(opt.price) / 100) * USD_TO_EUR,
        count: opt.count,
        is_voip: opt.is_voip,
        refundable: opt.refundable,
        renewable: opt.renewable,
        delivery_rate: opt.delivery,
        delivery_samples: opt.delivery_samples,
      });
    }
  }

  return offers;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("EVSES_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "EVSES_API_KEY secret is not configured." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "countries";
    const country = url.searchParams.get("country");
    const force = url.searchParams.get("force") === "true";

    const baseUrl = "https://api.eveses.com";
    const authHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };

    async function apiGet(path: string): Promise<{ ok: boolean; status: number; data: unknown; raw: string }> {
      const res = await fetch(`${baseUrl}${path}`, { headers: authHeaders });
      const text = await res.text();
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { ok: res.ok, status: res.status, data: parsed, raw: text };
    }

    // ── action=spain-catalog (cached, filtered) ──────────────────────
    if (action === "spain-catalog") {
      const now = Date.now();
      const cached = pricingCache.get("es");

      if (!force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        const offers = cached.data as CatalogOffer[];
        const body: SpainCatalogResponse = {
          success: true,
          country: "es",
          currency: "USD",
          offers,
          cached_at: cached.fetchedAt,
          fetched_at: cached.fetchedAt,
          cache_age_seconds: Math.floor((now - cached.fetchedAt) / 1000),
          source: "cache",
        };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cache miss or expired — fetch live from Eveses
      const path = "/api/v1/numbers/pricing?mode=rent&country=es&service=anyother";
      const r = await apiGet(path);

      if (!r.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Eveses pricing API returned an error.",
            detail: r.raw.substring(0, 500),
            country: "es",
            offers: [],
            cached_at: null,
            fetched_at: null,
            cache_age_seconds: null,
            source: "live",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pricing = r.data as PricingData;
      const offers = filterSpainOffers(pricing);

      pricingCache.set("es", {
        data: offers,
        fetchedAt: now,
        httpStatus: r.status,
        ok: r.ok,
      });

      const body: SpainCatalogResponse = {
        success: true,
        country: "es",
        currency: pricing?.currency || "USD",
        offers,
        cached_at: now,
        fetched_at: now,
        cache_age_seconds: 0,
        source: "live",
      };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── action=validate-offer (pre-purchase live check, no cache) ──────
    // Re-queries Eveses pricing for Spain and finds a valid offer matching
    // the requested duration. Returns the offer if still valid, or an error.
    if (action === "validate-offer") {
      const reqDuration = url.searchParams.get("duration");
      if (!reqDuration) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing 'duration' parameter (minutes)." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const durationMin = parseInt(reqDuration, 10);
      if (isNaN(durationMin)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid duration parameter." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Always live — never use cache for pre-purchase validation
      const path = "/api/v1/numbers/pricing?mode=rent&country=es&service=anyother";
      const r = await apiGet(path);

      if (!r.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No se pudo contactar con el proveedor. Inténtalo de nuevo.",
            detail: r.raw.substring(0, 500),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pricing = r.data as PricingData;
      const allOffers = filterSpainOffers(pricing);
      const match = allOffers.find((o) => o.duration_minutes === durationMin);

      if (!match) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Esta oferta acaba de agotarse. Inténtalo de nuevo.",
            valid: false,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          valid: true,
          offer: match,
          currency: pricing?.currency || "USD",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Legacy actions (diagnostic page) ──────────────────────────────
    const result: Record<string, unknown> = { success: true, queries: {} };

    if (action === "countries") {
      const r = await apiGet("/api/v1/numbers/countries?mode=rent");
      (result.queries as Record<string, unknown>).countries = {
        httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 3000),
      };
    }

    if (action === "pricing") {
      if (!country) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing 'country' parameter." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const path = `/api/v1/numbers/pricing?mode=rent&country=${encodeURIComponent(country)}&service=anyother`;
      const r = await apiGet(path);
      (result.queries as Record<string, unknown>).pricing = {
        httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 10000),
        queriedCountry: country,
      };
    }

    if (action === "products") {
      const r = await apiGet("/api/v1/numbers/products?mode=rent");
      (result.queries as Record<string, unknown>).products = {
        httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 2000),
      };
    }

    if (action === "summary") {
      const r = await apiGet("/api/v1/numbers/summary?mode=rent");
      (result.queries as Record<string, unknown>).summary = {
        httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 3000),
      };
    }

    if (action === "balance") {
      const r = await apiGet("/api/v1/wallet");
      (result.queries as Record<string, unknown>).balance = {
        httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 500),
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: "Network or runtime error.", detail: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
