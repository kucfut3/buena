// Eveses catalog Edge Function — queries the NATIVE REST API for rental pricing.
// Uses Bearer token auth (EVSES_API_KEY). No sms-activate gateway.
// Product: Private Number — Any Service (service=anyother, mode=rent)
//
// Actions:
//   spain-catalog     — cached Spain-only filtered offers (legacy, kept for compatibility)
//   validate-offer    — live pre-purchase validation for a specific duration
//   explorer-pricing  — fetch ALL countries' pricing in one call, cached 90s
//   public-catalog    — return catalog_products table joined with live Eveses stock
//   countries/pricing/products/summary/balance — legacy diagnostic actions

// ── In-memory cache (resets on cold start) ──────────────────────────────
interface CacheEntry {
  data: unknown;
  fetchedAt: number;
  httpStatus: number;
  ok: boolean;
}

const CACHE_TTL_MS = 90 * 1000;
const pricingCache = new Map<string, CacheEntry>(); // key = country code or "all"

const SALE_MARKUP_PERCENT = 100;
const USD_TO_EUR = 0.92;

function computeSalePrice(providerPriceCents: number): number {
  return Math.round(providerPriceCents * (1 + SALE_MARKUP_PERCENT / 100));
}

const ALLOWED_DURATIONS_MIN = [4320, 10080, 20160, 43200]; // 3d, 7d, 14d, 30d
const MAX_PROVIDER_PRICE_CENTS = 1000; // $10.00

// ── Types ──────────────────────────────────────────────────────────────
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

// ── Explorer types ─────────────────────────────────────────────────────
interface ExplorerOffer {
  country_code: string;
  duration_minutes: number;
  duration_label: string;
  provider_price_cents: number;
  provider_price_usd: number;
  count: number;
  renewable: boolean;
  is_voip: boolean;
  refundable: boolean;
  delivery_rate: number;
  delivery_samples: number;
}

interface ExplorerResponse {
  success: boolean;
  error?: string;
  offers: ExplorerOffer[];
  countries: string[];
  fetched_at: number | null;
  cache_age_seconds: number | null;
  source: "cache" | "live";
}

// ── Public catalog types ───────────────────────────────────────────────
interface CatalogProductRow {
  id: string;
  country_code: string;
  country_name: string;
  duration_minutes: number;
  duration_label: string;
  provider_price_cents: number;
  markup_percent: number;
  custom_price_eur_cents: number | null;
}

interface PublicCatalogItem {
  id: string;
  country_code: string;
  country_name: string;
  duration_minutes: number;
  duration_label: string;
  sale_price_eur: number;
  sale_price_eur_cents: number;
  available: boolean;
  renewable: boolean;
  delivery_rate: number;
  delivery_samples: number;
}

interface PublicCatalogResponse {
  success: boolean;
  error?: string;
  items: PublicCatalogItem[];
  fetched_at: number | null;
  source: "cache" | "live";
}

function durationLabel(min: number): string {
  if (min >= 43200) return "30 días";
  if (min >= 20160) return "14 días";
  if (min >= 10080) return "7 días";
  if (min >= 4320) return "3 días";
  return `${min} min`;
}

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

      const saleCentsUsd = computeSalePrice(opt.price);
      const saleEur = saleCentsUsd * USD_TO_EUR;

      offers.push({
        duration_minutes: dur.duration,
        duration_label: durationLabel(dur.duration),
        provider_price_cents: opt.price,
        provider_price_usd: opt.price / 100,
        sale_price_cents: saleCentsUsd,
        sale_price_usd: saleCentsUsd / 100,
        sale_price_eur_cents: Math.round(saleEur),
        sale_price_eur: Math.round(saleEur) / 100,
        count: opt.count,
        renewable: opt.renewable,
        delivery_rate: opt.delivery,
        delivery_samples: opt.delivery_samples,
      });
    }
  }

  return offers;
}

// Extract all offers from a pricing response (no filtering — explorer does that client-side)
function extractAllOffers(pricing: PricingData, countryCode: string): ExplorerOffer[] {
  const service = pricing.services?.find((s) => s.name === "anyother");
  if (!service) return [];

  const offers: ExplorerOffer[] = [];

  for (const dur of service.durations) {
    for (const opt of dur.options) {
      offers.push({
        country_code: countryCode,
        duration_minutes: dur.duration,
        duration_label: durationLabel(dur.duration),
        provider_price_cents: opt.price,
        provider_price_usd: opt.price / 100,
        count: opt.count,
        renewable: opt.renewable,
        is_voip: opt.is_voip,
        refundable: opt.refundable,
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
          success: true, country: "es", currency: "USD", offers,
          cached_at: cached.fetchedAt, fetched_at: cached.fetchedAt,
          cache_age_seconds: Math.floor((now - cached.fetchedAt) / 1000), source: "cache",
        };
        return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const r = await apiGet("/api/v1/numbers/pricing?mode=rent&country=es&service=anyother");
      if (!r.ok) {
        return new Response(JSON.stringify({ success: false, error: "Eveses pricing API returned an error.", detail: r.raw.substring(0, 500), country: "es", offers: [], cached_at: null, fetched_at: null, cache_age_seconds: null, source: "live" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const pricing = r.data as PricingData;
      const offers = filterSpainOffers(pricing);
      pricingCache.set("es", { data: offers, fetchedAt: now, httpStatus: r.status, ok: r.ok });

      const body: SpainCatalogResponse = { success: true, country: "es", currency: pricing?.currency || "USD", offers, cached_at: now, fetched_at: now, cache_age_seconds: 0, source: "live" };
      return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── action=validate-offer (pre-purchase live check, no cache) ──────
    if (action === "validate-offer") {
      const reqDuration = url.searchParams.get("duration");
      if (!reqDuration) return new Response(JSON.stringify({ success: false, error: "Missing 'duration' parameter (minutes)." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const durationMin = parseInt(reqDuration, 10);
      if (isNaN(durationMin)) return new Response(JSON.stringify({ success: false, error: "Invalid duration parameter." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const r = await apiGet("/api/v1/numbers/pricing?mode=rent&country=es&service=anyother");
      if (!r.ok) return new Response(JSON.stringify({ success: false, error: "No se pudo contactar con el proveedor. Inténtalo de nuevo.", detail: r.raw.substring(0, 500) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const pricing = r.data as PricingData;
      const allOffers = filterSpainOffers(pricing);
      const match = allOffers.find((o) => o.duration_minutes === durationMin);

      if (!match) return new Response(JSON.stringify({ success: false, error: "Esta oferta acaba de agotarse. Inténtalo de nuevo.", valid: false }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      return new Response(JSON.stringify({ success: true, valid: true, offer: match, currency: pricing?.currency || "USD" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── action=explorer-pricing (all countries, cached 90s) ───────────
    if (action === "explorer-pricing") {
      const now = Date.now();
      const cached = pricingCache.get("all");

      if (!force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        const cachedData = cached.data as { offers: ExplorerOffer[]; countries: string[] };
        const body: ExplorerResponse = {
          success: true, offers: cachedData.offers, countries: cachedData.countries,
          fetched_at: cached.fetchedAt, cache_age_seconds: Math.floor((now - cached.fetchedAt) / 1000), source: "cache",
        };
        return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 1. Fetch all available countries
      const countriesRes = await apiGet("/api/v1/numbers/countries?mode=rent");
      if (!countriesRes.ok) {
        return new Response(JSON.stringify({ success: false, error: "Failed to fetch countries.", offers: [], countries: [], fetched_at: null, cache_age_seconds: null, source: "live" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let countryList: string[] = [];
      const cData = countriesRes.data;
      if (typeof cData === "object" && cData !== null && !Array.isArray(cData)) {
        const obj = cData as Record<string, unknown>;
        if (Array.isArray(obj.countries)) countryList = obj.countries as string[];
      } else if (Array.isArray(cData)) {
        countryList = cData as string[];
      }

      if (countryList.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "No countries returned.", offers: [], countries: [], fetched_at: null, cache_age_seconds: null, source: "live" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Fetch pricing for each country (with limited concurrency)
      const allOffers: ExplorerOffer[] = [];
      const CONCURRENCY = 5;
      const chunks: string[][] = [];
      for (let i = 0; i < countryList.length; i += CONCURRENCY) {
        chunks.push(countryList.slice(i, i + CONCURRENCY));
      }

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (cc) => {
            const r = await apiGet(`/api/v1/numbers/pricing?mode=rent&country=${cc}&service=anyother`);
            if (!r.ok) return [];
            const pricing = r.data as PricingData;
            return extractAllOffers(pricing, cc);
          })
        );
        for (const result of results) {
          if (result.status === "fulfilled") allOffers.push(...result.value);
        }
      }

      const cacheData = { offers: allOffers, countries: countryList };
      pricingCache.set("all", { data: cacheData, fetchedAt: now, httpStatus: 200, ok: true });

      const body: ExplorerResponse = { success: true, offers: allOffers, countries: countryList, fetched_at: now, cache_age_seconds: 0, source: "live" };
      return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── action=public-catalog (catalog_products + live stock) ─────────
    if (action === "public-catalog") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

      // 1. Fetch catalog_products from Supabase
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/catalog_products?select=*`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      });
      if (!dbRes.ok) {
        return new Response(JSON.stringify({ success: false, error: "Failed to fetch catalog_products.", items: [], fetched_at: null, source: "live" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const products = (await dbRes.json()) as CatalogProductRow[];

      if (products.length === 0) {
        return new Response(JSON.stringify({ success: true, items: [], fetched_at: Date.now(), source: "live" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Fetch live pricing for each unique country in catalog_products
      const uniqueCountries = [...new Set(products.map((p) => p.country_code))];
      const liveStockMap = new Map<string, ExplorerOffer[]>();

      for (const cc of uniqueCountries) {
        const r = await apiGet(`/api/v1/numbers/pricing?mode=rent&country=${cc}&service=anyother`);
        if (r.ok) {
          const pricing = r.data as PricingData;
          liveStockMap.set(cc, extractAllOffers(pricing, cc));
        }
      }

      // 3. Build public catalog items
      const items: PublicCatalogItem[] = [];
      for (const product of products) {
        const countryOffers = liveStockMap.get(product.country_code) || [];
        const liveOffer = countryOffers.find(
          (o) => o.duration_minutes === product.duration_minutes &&
                 o.provider_price_cents === product.provider_price_cents
        );
        // Also try matching just by duration if exact price match fails
        const liveByDuration = countryOffers.find((o) => o.duration_minutes === product.duration_minutes);
        const live = liveOffer || liveByDuration;

        // Compute sale price
        let saleEurCents: number;
        if (product.custom_price_eur_cents !== null) {
          saleEurCents = product.custom_price_eur_cents;
        } else {
          const saleUsdCents = Math.round(product.provider_price_cents * (1 + product.markup_percent / 100));
          saleEurCents = Math.round(saleUsdCents * USD_TO_EUR);
        }

        items.push({
          id: product.id,
          country_code: product.country_code,
          country_name: product.country_name,
          duration_minutes: product.duration_minutes,
          duration_label: product.duration_label,
          sale_price_eur: saleEurCents / 100,
          sale_price_eur_cents: saleEurCents,
          available: live ? live.count > 0 : false,
          renewable: live?.renewable ?? true,
          delivery_rate: live?.delivery_rate ?? 0,
          delivery_samples: live?.delivery_samples ?? 0,
        });
      }

      return new Response(JSON.stringify({ success: true, items, fetched_at: Date.now(), source: "live" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Legacy actions (diagnostic page) ──────────────────────────────
    const result: Record<string, unknown> = { success: true, queries: {} };

    if (action === "countries") {
      const r = await apiGet("/api/v1/numbers/countries?mode=rent");
      (result.queries as Record<string, unknown>).countries = { httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 3000) };
    }

    if (action === "pricing") {
      if (!country) return new Response(JSON.stringify({ success: false, error: "Missing 'country' parameter." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const r = await apiGet(`/api/v1/numbers/pricing?mode=rent&country=${encodeURIComponent(country)}&service=anyother`);
      (result.queries as Record<string, unknown>).pricing = { httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 10000), queriedCountry: country };
    }

    if (action === "products") {
      const r = await apiGet("/api/v1/numbers/products?mode=rent");
      (result.queries as Record<string, unknown>).products = { httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 2000) };
    }

    if (action === "summary") {
      const r = await apiGet("/api/v1/numbers/summary?mode=rent");
      (result.queries as Record<string, unknown>).summary = { httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 3000) };
    }

    if (action === "balance") {
      const r = await apiGet("/api/v1/wallet");
      (result.queries as Record<string, unknown>).balance = { httpStatus: r.status, ok: r.ok, data: r.data, raw: r.raw.substring(0, 500) };
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: "Network or runtime error.", detail: message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
