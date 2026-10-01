import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  Loader2,
  XCircle,
  RefreshCw,
  Globe2,
  Clock,
  RotateCcw,
  TrendingUp,
  Plus,
  Check,
  Trash2,
  Pencil,
  X,
  Search,
  Server,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { useLang } from "@/LanguageContext";
import { supabase } from "@/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────
interface ExplorerOffer {
  eveses_offer_id: string;
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

interface ExplorerDebug {
  countries_received: number;
  countries_has_es: boolean;
  offers_received: number;
  es_offers_received: number;
}

interface ExplorerResponse {
  success: boolean;
  error?: string;
  offers: ExplorerOffer[];
  countries: string[];
  fetched_at: number | null;
  cache_age_seconds: number | null;
  source: "cache" | "live";
  debug?: ExplorerDebug;
}

interface CatalogProduct {
  id: string;
  country_code: string;
  country_name: string;
  duration_minutes: number;
  duration_label: string;
  provider_price_cents: number;
  markup_percent: number;
  custom_price_eur_cents: number | null;
  eveses_offer_id?: string | null;
  renewable?: boolean;
  stock?: number;
  available?: boolean;
  updated_at?: string;
}

interface QueryResult {
  httpStatus: number;
  ok: boolean;
  data: unknown;
  raw: string;
  queriedCountry?: string;
}

interface CatalogResponse {
  success: boolean;
  error?: string;
  detail?: string;
  queries?: {
    countries?: QueryResult;
    pricing?: QueryResult;
    products?: QueryResult;
    summary?: QueryResult;
    balance?: QueryResult;
  };
}

// ── Country names & flags ─────────────────────────────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  us: "United States", gb: "United Kingdom", ca: "Canada", au: "Australia",
  de: "Germany", fr: "France", es: "Spain", it: "Italy", nl: "Netherlands",
  ru: "Russia", ua: "Ukraine", pl: "Poland", se: "Sweden", fi: "Finland",
  ro: "Romania", id: "Indonesia", ph: "Philippines", br: "Brazil",
  mx: "Mexico", in: "India", jp: "Japan", kr: "South Korea", za: "South Africa",
  ar: "Argentina", cl: "Chile", co: "Colombia", pe: "Peru", th: "Thailand",
  vn: "Vietnam", tr: "Turkey", eg: "Egypt", ma: "Morocco", ng: "Nigeria",
  ke: "Kenya", pk: "Pakistan", bd: "Bangladesh", pt: "Portugal", gr: "Greece",
  cz: "Czech Republic", hu: "Hungary", be: "Belgium", at: "Austria", ch: "Switzerland",
  dk: "Denmark", no: "Norway", ie: "Ireland", nz: "New Zealand", sg: "Singapore",
  my: "Malaysia", hk: "Hong Kong", tw: "Taiwan", sa: "Saudi Arabia", ae: "UAE",
  il: "Israel", kz: "Kazakhstan", uz: "Uzbekistan", az: "Azerbaijan",
  ge: "Georgia", am: "Armenia", by: "Belarus", lt: "Lithuania", lv: "Latvia",
  ee: "Estonia", sk: "Slovakia", si: "Slovenia", hr: "Croatia", bg: "Bulgaria",
  rs: "Serbia", mk: "North Macedonia", al: "Albania", ba: "Bosnia", me: "Montenegro",
  // Extended coverage
  ad: "Andorra", ag: "Antigua & Barbuda", ai: "Anguilla", ao: "Angola",
  aw: "Aruba", ax: "Åland Islands", bb: "Barbados",
  bf: "Burkina Faso", bi: "Burundi", bj: "Benin", bm: "Bermuda",
  bn: "Brunei", bo: "Bolivia", bs: "Bahamas", bw: "Botswana",
  bz: "Belize", cd: "DR Congo", cf: "Central African Rep.", cg: "Congo",
  ci: "Côte d'Ivoire", ck: "Cook Islands", cm: "Cameroon", cn: "China",
  cr: "Costa Rica", cu: "Cuba", cv: "Cape Verde", cw: "Curaçao",
  cy: "Cyprus", dj: "Djibouti", dm: "Dominica", do: "Dominican Rep.",
  ec: "Ecuador", er: "Eritrea", et: "Ethiopia",
  fj: "Fiji", fo: "Faroe Islands", ga: "Gabon", gd: "Grenada",
  gf: "French Guiana", gh: "Ghana", gi: "Gibraltar", gl: "Greenland",
  gm: "Gambia", gn: "Guinea", gp: "Guadeloupe", gq: "Equatorial Guinea",
  gt: "Guatemala", gw: "Guinea-Bissau", gy: "Guyana", hn: "Honduras",
  ht: "Haiti", is: "Iceland", jm: "Jamaica", jo: "Jordan",
  kh: "Cambodia", ki: "Kiribati", km: "Comoros", kn: "St. Kitts & Nevis",
  kp: "North Korea", kw: "Kuwait", ky: "Cayman Islands", la: "Laos",
  lb: "Lebanon", lc: "St. Lucia", li: "Liechtenstein", lr: "Liberia",
  ls: "Lesotho", lu: "Luxembourg", ly: "Libya", mc: "Monaco",
  md: "Moldova", mg: "Madagascar", mh: "Marshall Islands", ml: "Mali",
  mm: "Myanmar", mn: "Mongolia", mo: "Macau", mq: "Martinique",
  mr: "Mauritania", ms: "Montserrat", mt: "Malta", mu: "Mauritius",
  mv: "Maldives", mw: "Malawi", mz: "Mozambique", na: "Namibia",
  nc: "New Caledonia", ne: "Niger", nf: "Norfolk Island", ni: "Nicaragua",
  np: "Nepal", nr: "Nauru", nu: "Niue", om: "Oman",
  pw: "Palau", pa: "Panama", pg: "Papua New Guinea", py: "Paraguay",
  pm: "St. Pierre & Miquelon", pn: "Pitcairn", pr: "Puerto Rico",
  ps: "Palestine", qa: "Qatar", re: "Réunion",
  rw: "Rwanda", sb: "Solomon Islands", sc: "Seychelles", sd: "Sudan",
  sh: "St. Helena", sl: "Sierra Leone", sm: "San Marino", sn: "Senegal",
  so: "Somalia", sr: "Suriname", ss: "South Sudan", st: "São Tomé & Príncipe",
  sv: "El Salvador", sx: "Sint Maarten", sy: "Syria", sz: "Eswatini",
  tc: "Turks & Caicos", td: "Chad", tg: "Togo", tj: "Tajikistan",
  tk: "Tokelau", tl: "Timor-Leste", tm: "Turkmenistan", tn: "Tunisia",
  to: "Tonga", tt: "Trinidad & Tobago", tv: "Tuvalu", tz: "Tanzania",
  ug: "Uganda", uy: "Uruguay", va: "Vatican City", vc: "St. Vincent",
  ve: "Venezuela", vg: "British Virgin Islands", vi: "U.S. Virgin Islands",
  vu: "Vanuatu", wf: "Wallis & Futuna", ws: "Samoa", ye: "Yemen",
  zm: "Zambia", zw: "Zimbabwe",
};

const COUNTRY_FLAGS: Record<string, string> = {
  us: "🇺🇸", gb: "🇬🇧", ca: "🇨🇦", au: "🇦🇺", de: "🇩🇪", fr: "🇫🇷",
  es: "🇪🇸", it: "🇮🇹", nl: "🇳🇱", ru: "🇷🇺", ua: "🇺🇦", pl: "🇵🇱",
  se: "🇸🇪", fi: "🇫🇮", ro: "🇷🇴", id: "🇮🇩", ph: "🇵🇭", br: "🇧🇷",
  mx: "🇲🇽", in: "🇮🇳", jp: "🇯🇵", kr: "🇰🇷", za: "🇿🇦", ar: "🇦🇷",
  cl: "🇨🇱", co: "🇨🇴", pe: "🇵🇪", th: "🇹🇭", vn: "🇻🇳", tr: "🇹🇷",
  eg: "🇪🇬", ma: "🇲🇦", ng: "🇳🇬", ke: "🇰🇪", pk: "🇵🇰", bd: "🇧🇩",
  pt: "🇵🇹", gr: "🇬🇷", cz: "🇨🇿", hu: "🇭🇺", be: "🇧🇪", at: "🇦🇹",
  ch: "🇨🇭", dk: "🇩🇰", no: "🇳🇴", ie: "🇮🇪", nz: "🇳🇿", sg: "🇸🇬",
  my: "🇲🇾", hk: "🇭🇰", tw: "🇹🇼", sa: "🇸🇦", ae: "🇦🇪", il: "🇮🇱",
  kz: "🇰🇿", uz: "🇺🇿", az: "🇦🇿", ge: "🇬🇪", am: "🇦🇲", by: "🇧🇾",
  lt: "🇱🇹", lv: "🇱🇻", ee: "🇪🇪", sk: "🇸🇰", si: "🇸🇮", hr: "🇭🇷",
  bg: "🇧🇬", rs: "🇷🇸", mk: "🇲🇰", al: "🇦🇱", ba: "🇧🇦", me: "🇲🇪",
  // Extended
  ad: "🇦🇩", ag: "🇦🇬", ao: "🇦🇴", aw: "🇦🇼", bb: "🇧🇧", bf: "🇧🇫",
  bi: "🇧🇮", bj: "🇧🇯", bm: "🇧🇲", bn: "🇧🇳", bo: "🇧🇴", bs: "🇧🇸",
  bw: "🇧🇼", bz: "🇧🇿", cd: "🇨🇩", cf: "🇨🇫", cg: "🇨🇬", ci: "🇨🇮",
  ck: "🇨🇰", cm: "🇨🇲", cn: "🇨🇳", cr: "🇨🇷", cu: "🇨🇺", cv: "🇨🇻",
  cw: "🇨🇼", cy: "🇨🇾", dj: "🇩🇯", dm: "🇩🇲", do: "🇩🇴", ec: "🇪🇨",
  er: "🇪🇷", et: "🇪🇹", fj: "🇫🇯", fo: "🇫🇴", ga: "🇬🇦", gd: "🇬🇩",
  gf: "🇬🇫", gh: "🇬🇭", gi: "🇬🇮", gl: "🇬🇱", gm: "🇬🇲", gn: "🇬🇳",
  gp: "🇬🇵", gq: "🇬🇶", gt: "🇬🇹", gw: "🇬🇼", gy: "🇬🇾", hn: "🇭🇳",
  ht: "🇭🇹", is: "🇮🇸", jm: "🇯🇲", jo: "🇯🇴", kh: "🇰🇭", ki: "🇰🇮",
  km: "🇰🇲", kn: "🇰🇳", kp: "🇰🇵", kw: "🇰🇼", ky: "🇰🇾", la: "🇱🇦",
  lb: "🇱🇧", lc: "🇱🇨", li: "🇱🇮", lr: "🇱🇷", ls: "🇱🇸", lu: "🇱🇺",
  ly: "🇱🇾", mc: "🇲🇨", md: "🇲🇩", mg: "🇲🇬", mh: "🇲🇭", ml: "🇲🇱",
  mm: "🇲🇲", mn: "🇲🇳", mo: "🇲🇴", mq: "🇲🇶", mr: "🇲🇷", ms: "🇲🇸",
  mt: "🇲🇹", mu: "🇲🇺", mv: "🇲🇻", mw: "🇲🇼", mz: "🇲🇿", na: "🇳🇦",
  nc: "🇳🇨", ne: "🇳🇪", nf: "🇳🇫", ni: "🇳🇮", np: "🇳🇵", nr: "🇳🇷",
  nu: "🇳🇺", om: "🇴🇲", pw: "🇵🇼", pa: "🇵🇦", pg: "🇵🇬", py: "🇵🇾",
  pm: "🇵🇲", pn: "🇵🇳", pr: "🇵🇷", ps: "🇵🇸", qa: "🇶🇦", re: "🇷🇪",
  rw: "🇷🇼", sb: "🇸🇧", sc: "🇸🇨", sd: "🇸🇩", sh: "🇸🇭", sl: "🇸🇱",
  sm: "🇸🇲", sn: "🇸🇳", so: "🇸🇴", sr: "🇸🇷", ss: "🇸🇸", st: "🇸🇹",
  sv: "🇸🇻", sx: "🇸🇽", sy: "🇸🇾", sz: "🇸🇿", tc: "🇹🇨", td: "🇹🇩",
  tg: "🇹🇬", tj: "🇹🇯", tk: "🇹🇰", tl: "🇹🇱", tm: "🇹🇲", tn: "🇹🇳",
  to: "🇹🇴", tt: "🇹🇹", tv: "🇹🇻", tz: "🇹🇿", ug: "🇺🇬", uy: "🇺🇾",
  va: "🇻🇦", vc: "🇻🇨", ve: "🇻🇪", vg: "🇻🇬", vi: "🇻🇮", vu: "🇻🇺",
  wf: "🇼🇫", ws: "🇼🇸", ye: "🇾🇪", zm: "🇿🇲", zw: "🇿🇼",
};

function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] || code.toUpperCase();
}

function getCountryFlag(code: string): string {
  return COUNTRY_FLAGS[code] || "🏳️";
}

function formatDuration(minutes: number): string {
  if (minutes >= 43200) return "30 days";
  if (minutes >= 20160) return "14 days";
  if (minutes >= 10080) return "7 days";
  if (minutes >= 4320) return "3 days";
  if (minutes >= 1440) return "1 day";
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h` : `${minutes}m`;
}

const DURATION_FILTERS = [
  { minutes: 4320, label: "3 days" },
  { minutes: 10080, label: "7 days" },
  { minutes: 20160, label: "14 days" },
  { minutes: 43200, label: "30 days" },
];

const PRICE_PRESETS = [5, 10, 20];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function EvesesCatalogTestPage() {
  const { localizedPath } = useLang();

  // Explorer state
  const [explorerData, setExplorerData] = useState<ExplorerResponse | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);

  // Filters
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [stockOnly, setStockOnly] = useState(true);
  const [renewableOnly, setRenewableOnly] = useState(true);
  const [selectedDurations, setSelectedDurations] = useState<Set<number>>(new Set());
  const [maxPrice, setMaxPrice] = useState<number>(10);
  const [customMaxPrice, setCustomMaxPrice] = useState<string>("");
  const [searchCountry, setSearchCountry] = useState("");

  // Catalog products state
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [catalogActionError, setCatalogActionError] = useState<string | null>(null);

  // Edit price modal
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [editPriceEur, setEditPriceEur] = useState<string>("");
  const [editMarkup, setEditMarkup] = useState<string>("");

  // Legacy diagnostic state
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [countriesResult, setCountriesResult] = useState<CatalogResponse | null>(null);
  const [pricingResult, setPricingResult] = useState<CatalogResponse | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});

  // ── Fetch explorer pricing (all countries) ──────────────────────────
  const fetchExplorer = useCallback(async (forceRefresh = false) => {
    setLoadingExplorer(true);
    setExplorerError(null);
    try {
      const url = `${supabaseUrl}/functions/v1/eveses-catalog?action=explorer-pricing${forceRefresh ? "&force=true" : ""}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Eveses explorer request failed (${res.status}).`);
      const json = (await res.json()) as ExplorerResponse;
      if (!json.success || !Array.isArray(json.offers) || !Array.isArray(json.countries)) {
        setExplorerError(json.error || "Eveses returned an invalid explorer response.");
      } else {
        setExplorerData(json);
      }
    } catch (err) {
      setExplorerError(err instanceof Error ? err.message : "Connection error.");
    } finally {
      setLoadingExplorer(false);
    }
  }, []);

  // ── Fetch catalog products from Supabase ────────────────────────────
  const fetchCatalogProducts = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("*")
        .order("country_code", { ascending: true })
        .order("duration_minutes", { ascending: true });

      if (error) throw error;
      setCatalogProducts((data as CatalogProduct[]) || []);
    } catch {
      setCatalogProducts([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    fetchExplorer(true);
    fetchCatalogProducts();
  }, [fetchExplorer, fetchCatalogProducts]);

  // ── Add to catalog ──────────────────────────────────────────────────
  const addToCatalog = async (offer: ExplorerOffer) => {
    const key = `${offer.country_code}-${offer.duration_minutes}`;
    const evesesOfferId = offer.eveses_offer_id;
    setActionLoading(key);
    setCatalogActionError(null);
    try {
      const existing = getCatalogProduct(offer.country_code, offer.duration_minutes);
      const liveFields = {
        country_code: offer.country_code,
        country_name: getCountryName(offer.country_code),
        duration_minutes: offer.duration_minutes,
        duration_label: offer.duration_label,
        provider_price_cents: offer.provider_price_cents,
        eveses_offer_id: evesesOfferId,
        renewable: offer.renewable,
        stock: offer.count,
        available: offer.count > 0,
        updated_at: new Date().toISOString(),
      };

      const result = existing
        ? await supabase.from("catalog_products").update(liveFields).eq("id", existing.id)
        : await supabase.from("catalog_products").insert({ ...liveFields, markup_percent: 100 });
      if (result.error) throw result.error;
      await fetchCatalogProducts();
    } catch (error) {
      setCatalogActionError(error instanceof Error ? error.message : "No se pudo guardar la oferta.");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Remove from catalog ─────────────────────────────────────────────
  const removeFromCatalog = async (product: CatalogProduct) => {
    const key = `rm-${product.id}`;
    setActionLoading(key);
    try {
      const { error } = await supabase.from("catalog_products").delete().eq("id", product.id);
      if (error) throw error;
      await fetchCatalogProducts();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  // ── Save edited price ──────────────────────────────────────────────
  const saveEditedPrice = async () => {
    if (!editingProduct) return;
    setActionLoading(`edit-${editingProduct.id}`);
    try {
      const updates: Record<string, unknown> = {};
      if (editPriceEur.trim() !== "") {
        const eurCents = Math.round(parseFloat(editPriceEur) * 100);
        if (!isNaN(eurCents)) updates.custom_price_eur_cents = eurCents;
      } else {
        updates.custom_price_eur_cents = null;
      }
      if (editMarkup.trim() !== "") {
        const markup = parseInt(editMarkup, 10);
        if (!isNaN(markup)) updates.markup_percent = markup;
      }

      const { error } = await supabase
        .from("catalog_products")
        .update(updates)
        .eq("id", editingProduct.id);
      if (error) throw error;
      await fetchCatalogProducts();
      setEditingProduct(null);
      setEditPriceEur("");
      setEditMarkup("");
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  // ── Check if offer is in catalog ─────────────────────────────────────
  const isInCatalog = (countryCode: string, durationMin: number) => {
    return catalogProducts.some(
      (p) => p.country_code.toLowerCase() === countryCode.toLowerCase() && p.duration_minutes === durationMin
    );
  };

  const getCatalogProduct = (countryCode: string, durationMin: number) => {
    return catalogProducts.find(
      (p) => p.country_code.toLowerCase() === countryCode.toLowerCase() && p.duration_minutes === durationMin
    );
  };

  // ── Filtered offers ─────────────────────────────────────────────────
  const filteredOffers = useMemo(() => {
    if (!explorerData?.offers) return [];
    const effectiveMaxPrice = customMaxPrice.trim() !== "" ? parseFloat(customMaxPrice) : maxPrice;
    const priceCentsLimit = effectiveMaxPrice * 100;

    return explorerData.offers.filter((offer) => {
      if (
        selectedCountries.size > 0 &&
        !Array.from(selectedCountries).some((code) => code.toLowerCase() === offer.country_code.toLowerCase())
      ) return false;
      if (stockOnly && offer.count <= 0) return false;
      if (renewableOnly && !offer.renewable) return false;
      if (selectedDurations.size > 0 && !selectedDurations.has(offer.duration_minutes)) return false;
      if (offer.provider_price_cents >= priceCentsLimit) return false;
      return true;
    });
  }, [explorerData, selectedCountries, stockOnly, renewableOnly, selectedDurations, maxPrice, customMaxPrice]);

  // ── All countries returned by Eveses, including those without offers ─
  const availableCountries = useMemo(() => {
    if (!explorerData?.countries) return [];
    return Array.from(new Set(explorerData.countries)).sort((a, b) =>
      getCountryName(a).localeCompare(getCountryName(b))
    );
  }, [explorerData]);

  const filteredCountries = useMemo(() => {
    if (!searchCountry.trim()) return availableCountries;
    const q = searchCountry.toLowerCase();
    return availableCountries.filter(
      (c) => c.toLowerCase().includes(q) || getCountryName(c).toLowerCase().includes(q)
    );
  }, [availableCountries, searchCountry]);

  // ── Summary stats ───────────────────────────────────────────────────
  const uniqueCountryCount = useMemo(() => {
    return new Set(filteredOffers.map((o) => o.country_code.toLowerCase())).size;
  }, [filteredOffers]);

  const spainFilterDiagnostics = useMemo(() => {
    const spainOffers = (explorerData?.offers || []).filter((offer) => offer.country_code.toLowerCase() === "es");
    const stockOffers = spainOffers.filter((offer) => !stockOnly || offer.count > 0);
    const renewableOffers = stockOffers.filter((offer) => !renewableOnly || offer.renewable);
    const durationOffers = renewableOffers.filter(
      (offer) => selectedDurations.size === 0 || selectedDurations.has(offer.duration_minutes)
    );
    const effectiveMaxPrice = customMaxPrice.trim() !== "" ? parseFloat(customMaxPrice) : maxPrice;
    const priceOffers = durationOffers.filter((offer) => offer.provider_price_cents < effectiveMaxPrice * 100);
    return {
      received: spainOffers.length,
      afterStock: stockOffers.length,
      afterRenewable: renewableOffers.length,
      afterDuration: durationOffers.length,
      afterPrice: priceOffers.length,
    };
  }, [explorerData, stockOnly, renewableOnly, selectedDurations, maxPrice, customMaxPrice]);

  useEffect(() => {
    if (!explorerData) return;
    console.info("Eveses catalog diagnostics", {
      countriesReceived: explorerData.countries.length,
      countriesHasES: explorerData.countries.some((code) => code.toLowerCase() === "es"),
      offersReceived: explorerData.offers.length,
      spain: spainFilterDiagnostics,
    });
  }, [explorerData, spainFilterDiagnostics]);

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleDuration = (min: number) => {
    setSelectedDurations((prev) => {
      const next = new Set(prev);
      if (next.has(min)) next.delete(min);
      else next.add(min);
      return next;
    });
  };

  // ── Compute public price for display ─────────────────────────────────
  function computePublicPriceEur(product: CatalogProduct): number {
    if (product.custom_price_eur_cents !== null) {
      return product.custom_price_eur_cents / 100;
    }
    const saleUsdCents = Math.round(product.provider_price_cents * (1 + product.markup_percent / 100));
    return Math.round(saleUsdCents * 0.92) / 100;
  }

  // ── Legacy diagnostic fetchers ──────────────────────────────────────
  const fetchCountries = useCallback(async () => {
    setLoadingCountries(true);
    setCountriesResult(null);
    try {
      const url = `${supabaseUrl}/functions/v1/eveses-catalog?action=countries`;
      const res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" } });
      const json = await res.json();
      setCountriesResult(json as CatalogResponse);
    } catch (err) {
      setCountriesResult({ success: false, error: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoadingCountries(false);
    }
  }, []);

  const fetchPricing = useCallback(async (country: string) => {
    setLoadingPricing(true);
    setPricingResult(null);
    try {
      const url = `${supabaseUrl}/functions/v1/eveses-catalog?action=pricing&country=${country}`;
      const res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" } });
      const json = await res.json();
      setPricingResult(json as CatalogResponse);
    } catch (err) {
      setPricingResult({ success: false, error: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoadingPricing(false);
    }
  }, []);

  const toggleRaw = (key: string) => setShowRaw((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="min-h-screen w-full max-w-full overflow-hidden pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link to={localizedPath("/")} className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Volver al Inicio
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
            <Boxes className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Catalog Explorer</h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-lg mx-auto">
            Explora el catálogo completo de Eveses, filtra por país, duración, stock y precio.
            Añade o quita productos del catálogo público de GhostSMS.
          </p>
        </div>

        {/* Error */}
        {(explorerError || catalogActionError) && (
          <div className="mb-4 space-y-2">
            {explorerError && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                <XCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                <p className="text-sm text-zinc-300">{explorerError}</p>
              </div>
            )}
            {catalogActionError && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                <p className="text-sm text-zinc-300">{catalogActionError}</p>
                <button onClick={() => setCatalogActionError(null)} className="ml-auto text-xs text-zinc-500 hover:text-white">Cerrar</button>
              </div>
            )}
          </div>
        )}

        {/* ── Filters Panel ─────────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Filtros</h2>
            <button
              onClick={() => fetchExplorer(true)}
              disabled={loadingExplorer}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-amber-500/40 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingExplorer ? "animate-spin" : ""}`} />
              {loadingExplorer ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Stock filter */}
            <div>
              <label className="mb-2 block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Stock</label>
              <button
                onClick={() => setStockOnly(!stockOnly)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  stockOnly ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
                }`}
              >
                <span>Stock &gt; 0</span>
                <span className={`flex h-5 w-9 items-center rounded-full transition-colors ${stockOnly ? "bg-emerald-500" : "bg-zinc-600"}`}>
                  <span className={`h-4 w-4 rounded-full bg-white transition-transform ${stockOnly ? "translate-x-4" : "translate-x-0.5"}`} />
                </span>
              </button>
            </div>

            {/* Renewable filter */}
            <div>
              <label className="mb-2 block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Renewable</label>
              <button
                onClick={() => setRenewableOnly(!renewableOnly)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  renewableOnly ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
                }`}
              >
                <span>Solo renovables</span>
                <span className={`flex h-5 w-9 items-center rounded-full transition-colors ${renewableOnly ? "bg-emerald-500" : "bg-zinc-600"}`}>
                  <span className={`h-4 w-4 rounded-full bg-white transition-transform ${renewableOnly ? "translate-x-4" : "translate-x-0.5"}`} />
                </span>
              </button>
            </div>

            {/* Duration filter */}
            <div className="lg:col-span-2">
              <label className="mb-2 block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Duración</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_FILTERS.map((d) => {
                  const active = selectedDurations.has(d.minutes);
                  return (
                    <button
                      key={d.minutes}
                      onClick={() => toggleDuration(d.minutes)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                        active ? "border-amber-500/60 bg-amber-500/10 text-amber-400" : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
                {selectedDurations.size === 0 && (
                  <span className="text-[11px] text-zinc-500 self-center">Todas las duraciones</span>
                )}
              </div>
            </div>

            {/* Price filter */}
            <div className="lg:col-span-2">
              <label className="mb-2 block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Precio máximo del proveedor</label>
              <div className="flex flex-wrap items-center gap-2">
                {PRICE_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setMaxPrice(p); setCustomMaxPrice(""); }}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                      maxPrice === p && customMaxPrice.trim() === "" ? "border-amber-500/60 bg-amber-500/10 text-amber-400" : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    &lt; ${p}
                  </button>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">$</span>
                  <input
                    type="number"
                    value={customMaxPrice}
                    onChange={(e) => setCustomMaxPrice(e.target.value)}
                    placeholder="Manual"
                    className="w-20 rounded-lg border border-zinc-700 bg-zinc-800/40 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Country filter */}
          <div className="mt-4">
            <label className="mb-2 block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Países {selectedCountries.size > 0 && `( ${selectedCountries.size} seleccionados )`}
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchCountry}
                onChange={(e) => setSearchCountry(e.target.value)}
                placeholder="Buscar país..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/40 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              <button
                onClick={() => setSelectedCountries(new Set(availableCountries))}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
                  selectedCountries.size === availableCountries.length && availableCountries.length > 0
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                    : "border-zinc-600 bg-zinc-700/40 text-zinc-200 hover:border-amber-500/40"
                }`}
              >
                <Globe2 className="h-3 w-3" />
                Todos
              </button>
              {filteredCountries.map((code) => {
                const active = selectedCountries.has(code);
                return (
                  <button
                    key={code}
                    onClick={() => toggleCountry(code)}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                      active ? "border-amber-500/60 bg-amber-500/10 text-amber-400" : "border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <span>{getCountryFlag(code)}</span>
                    <span>{getCountryName(code)}</span>
                  </button>
                );
              })}
              {availableCountries.length === 0 && !loadingExplorer && (
                <span className="text-xs text-zinc-500">Carga los datos primero</span>
              )}
            </div>
            <div className="mt-2 flex gap-3">
              <button
                onClick={() => setSelectedCountries(new Set(availableCountries))}
                className="text-[11px] font-semibold text-zinc-400 hover:text-amber-400"
              >
                Seleccionar todos
              </button>
              {selectedCountries.size > 0 && (
                <button
                  onClick={() => setSelectedCountries(new Set())}
                  className="text-[11px] text-zinc-500 hover:text-white"
                >
                  Limpiar selección
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Summary ───────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-bold text-white">
              {filteredOffers.length} matching offers
            </span>
            <span className="text-xs text-zinc-500">
              across {uniqueCountryCount} {uniqueCountryCount === 1 ? "country" : "countries"}
            </span>
          </div>
          {explorerData && (
            <span className="text-[11px] text-zinc-500">
              {explorerData.source === "live" ? "EN VIVO" : "CACHÉ"}
              {explorerData.cache_age_seconds !== null && ` · ${explorerData.cache_age_seconds}s`}
            </span>
          )}
        </div>

        {/* ── Results Table ──────────────────────────────────────────── */}
        {loadingExplorer && !explorerData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            <span className="ml-2 text-sm text-zinc-400">Cargando catálogo completo...</span>
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-12 text-center">
            <Boxes className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-400">No offers match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-500">
                  <th className="px-3 py-2.5 font-semibold">País</th>
                  <th className="px-3 py-2.5 font-semibold">Duración</th>
                  <th className="px-3 py-2.5 font-semibold">Provider $</th>
                  <th className="px-3 py-2.5 font-semibold">Stock</th>
                  <th className="px-3 py-2.5 font-semibold">Renewable</th>
                  <th className="px-3 py-2.5 font-semibold">Success</th>
                  <th className="px-3 py-2.5 font-semibold">Samples</th>
                  <th className="px-3 py-2.5 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOffers.slice(0, 200).map((offer, i) => {
                  const key = `${offer.country_code}-${offer.duration_minutes}-${offer.provider_price_cents}-${i}`;
                  const inCatalog = isInCatalog(offer.country_code, offer.duration_minutes);
                  const catProduct = getCatalogProduct(offer.country_code, offer.duration_minutes);
                  const isLoading = actionLoading === `${offer.country_code}-${offer.duration_minutes}`;

                  return (
                    <tr key={key} className="border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/20">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{getCountryFlag(offer.country_code)}</span>
                          <span className="font-medium text-zinc-200">{getCountryName(offer.country_code)}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{offer.country_code}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-300">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-zinc-500" />
                          {formatDuration(offer.duration_minutes)}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-amber-400">
                        ${offer.provider_price_usd.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-mono font-semibold ${offer.count > 0 ? "text-emerald-400" : "text-zinc-500"}`}>
                          {offer.count}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {offer.renewable ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <RotateCcw className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-zinc-300">
                        {offer.delivery_samples > 0 ? `${(offer.delivery_rate * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-zinc-400">
                        {offer.delivery_samples > 0 ? offer.delivery_samples : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                        ) : inCatalog ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-400">
                              <Check className="h-3 w-3" />
                              In catalog
                            </span>
                            {catProduct && (
                              <>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  {computePublicPriceEur(catProduct).toFixed(2)} €
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingProduct(catProduct);
                                    setEditPriceEur(catProduct.custom_price_eur_cents !== null ? (catProduct.custom_price_eur_cents / 100).toString() : "");
                                    setEditMarkup(catProduct.markup_percent.toString());
                                  }}
                                  className="rounded p-1 text-zinc-400 hover:text-amber-400"
                                  title="Editar precio"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => removeFromCatalog(catProduct)}
                                  className="rounded p-1 text-zinc-400 hover:text-red-400"
                                  title="Remove from catalog"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCatalog(offer)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[10px] font-semibold text-zinc-300 transition-all hover:border-emerald-500/40 hover:text-emerald-400"
                          >
                            <Plus className="h-3 w-3" />
                            Add to catalog
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredOffers.length > 200 && (
              <div className="border-t border-zinc-800 px-4 py-2.5 text-center text-[11px] text-zinc-500">
                Showing first 200 of {filteredOffers.length} matching offers
              </div>
            )}
          </div>
        )}

        {/* ── Edit Price Modal ──────────────────────────────────────── */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingProduct(null)}>
            <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Editar precio público</h3>
                <button onClick={() => setEditingProduct(null)} className="text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 space-y-1 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Producto:</span>
                  <span className="font-medium text-zinc-200">
                    {getCountryFlag(editingProduct.country_code)} {editingProduct.country_name} · {editingProduct.duration_label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Provider price:</span>
                  <span className="font-mono text-amber-400">${(editingProduct.provider_price_cents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Precio público personalizado (EUR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPriceEur}
                    onChange={(e) => setEditPriceEur(e.target.value)}
                    placeholder="Vacío = usar markup"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">Deja vacío para calcular automáticamente con el markup.</p>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Markup (%)
                  </label>
                  <input
                    type="number"
                    value={editMarkup}
                    onChange={(e) => setEditMarkup(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Precio automático: {(() => {
                      const usd = Math.round(editingProduct.provider_price_cents * (1 + (parseInt(editMarkup) || 0) / 100));
                      return `${(Math.round(usd * 0.92) / 100).toFixed(2)} €`;
                    })()}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={saveEditedPrice}
                  disabled={actionLoading === `edit-${editingProduct.id}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition-all hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50"
                >
                  {actionLoading === `edit-${editingProduct.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Guardar
                </button>
                <button
                  onClick={() => setEditingProduct(null)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Current Catalog Products ─────────────────────────────── */}
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-bold text-white uppercase tracking-wider">
            Catálogo público actual ({catalogProducts.length} productos)
          </h2>
          {loadingCatalog ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
              <span className="text-xs text-zinc-400">Cargando...</span>
            </div>
          ) : catalogProducts.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
              <p className="text-sm text-zinc-400">No hay productos en el catálogo público.</p>
              <p className="mt-1 text-xs text-zinc-500">Usa los filtros de arriba y pulsa "Add to catalog" para añadir productos.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {catalogProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <span className="text-base">{getCountryFlag(p.country_code)}</span>
                  <span className="text-xs font-medium text-zinc-200">{p.country_name}</span>
                  <span className="text-[10px] text-zinc-500">{p.duration_label}</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{computePublicPriceEur(p).toFixed(2)} €</span>
                  <button
                    onClick={() => {
                      setEditingProduct(p);
                      setEditPriceEur(p.custom_price_eur_cents !== null ? (p.custom_price_eur_cents / 100).toString() : "");
                      setEditMarkup(p.markup_percent.toString());
                    }}
                    className="text-zinc-500 hover:text-amber-400"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeFromCatalog(p)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Legacy Diagnostic Toggle ───────────────────────────────── */}
        <div className="mt-8 border-t border-zinc-800 pt-6">
          <button
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            className="flex items-center gap-2 text-xs font-semibold text-zinc-500 transition-colors hover:text-white"
          >
            <Server className="h-4 w-4" />
            {showDiagnostic ? "Ocultar" : "Mostrar"} diagnóstico de API (legacy)
          </button>
        </div>

        {showDiagnostic && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={fetchCountries}
                disabled={loadingCountries}
                className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 px-7 py-3.5 text-sm font-bold text-zinc-950 shadow-xl shadow-amber-500/10 transition-all hover:from-amber-400 hover:to-yellow-400 disabled:opacity-60 active:scale-[0.98]"
              >
                {loadingCountries ? <><Loader2 className="h-5 w-5 animate-spin" /> Cargando...</> : <><Globe2 className="h-5 w-5" /> Cargar países</>}
              </button>
            </div>

            {countriesResult?.queries?.countries && (
              <DiagnosticCard label="Países (mode=rent)" icon={Globe2} query={countriesResult.queries.countries} showRaw={showRaw["countries"] || false} onToggle={() => toggleRaw("countries")} />
            )}

            {Boolean(countriesResult?.queries?.countries?.data) && typeof countriesResult?.queries?.countries?.data === "object" && countriesResult.queries.countries.data !== null && (
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Selecciona un país</label>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const d = countriesResult.queries.countries!.data as Record<string, unknown>;
                    const list = Array.isArray(d.countries) ? d.countries as string[] : [];
                    return list.map((c) => (
                      <button
                        key={c}
                        onClick={() => { setSelectedCountry(c); fetchPricing(c); }}
                        disabled={loadingPricing}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all disabled:opacity-50 ${
                          selectedCountry === c ? "border-amber-500/60 bg-amber-500/10 text-amber-400" : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        <span className="text-base">{getCountryFlag(c)}</span>
                        <span>{getCountryName(c)}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{c}</span>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            )}

            {pricingResult?.queries?.pricing && (
              <DiagnosticCard label={`Pricing (${selectedCountry})`} icon={Server} query={pricingResult.queries.pricing} showRaw={showRaw["pricing"] || false} onToggle={() => toggleRaw("pricing")} />
            )}

            {pricingResult && !pricingResult.success && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                <p className="text-sm text-zinc-300">{pricingResult.error}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-600">
            Herramienta de administración. La API Key nunca se expone al navegador.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Diagnostic Card component ──────────────────────────────────────────
function DiagnosticCard({ label, icon: Icon, query, showRaw, onToggle }: {
  label: string;
  icon: typeof Globe2;
  query: QueryResult;
  showRaw: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${query.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">{label}</span>
            <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${query.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              HTTP {query.httpStatus}
            </span>
          </div>
        </div>
        <button onClick={onToggle} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors">
          {showRaw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showRaw ? "Ocultar" : "Ver JSON"}
        </button>
      </div>
      <div className="p-4">
        {showRaw && (
          <pre className="max-h-96 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap break-all">
            {JSON.stringify(query.data, null, 2)}
          </pre>
        )}
        {!query.ok && <div className="text-xs text-red-300 font-mono break-all">{query.raw}</div>}
      </div>
    </div>
  );
}
