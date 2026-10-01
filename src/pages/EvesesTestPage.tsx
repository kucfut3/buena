import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Wifi,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  KeyRound,
  Server,
  Eye,
  EyeOff,
} from "lucide-react";
import { useLang } from "@/LanguageContext";
import { supabase } from "@/supabaseClient";

type TestResult = {
  success: boolean;
  httpStatus?: number;
  message?: string;
  error?: string;
  detail?: string;
  evesesResponse?: unknown;
  wallet?: {
    balance_cents: number | null;
    currency: string | null;
  };
  rawKeys?: string[];
};

export function EvesesTestPage() {
  const { localizedPath } = useLang();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [showFullResponse, setShowFullResponse] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    setShowFullResponse(false);

    try {
      const { data, error } = await supabase.functions.invoke("eveses-test", {
        method: "GET",
      });

      if (error) {
        setResult({
          success: false,
          error: "Edge Function error",
          detail: error.message,
        });
      } else {
        setResult(data as TestResult);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({
        success: false,
        error: "Failed to call the Edge Function.",
        detail: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-hidden pt-24 pb-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
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
            <Wifi className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Prueba de Conexión Eveses
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-md mx-auto">
            Verifica que la API Key de Eveses está correctamente configurada y que
            la autenticación funciona. No se compra ni reserva ningún número.
          </p>
        </div>

        {/* Security info */}
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-xs text-zinc-400 leading-relaxed">
            La API Key se lee desde los secretos de Supabase Edge Functions y
            <strong className="text-zinc-300"> nunca</strong> se expone en el navegador.
            Toda la comunicación con Eveses ocurre en el servidor.
          </div>
        </div>

        {/* Run button */}
        <div className="flex justify-center">
          <button
            onClick={runTest}
            disabled={loading}
            className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-500/10 transition-all hover:from-emerald-400 hover:to-teal-500 disabled:opacity-60 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Probando conexión...
              </>
            ) : (
              <>
                <Server className="h-5 w-5" />
                Ejecutar prueba de conexión
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-8 space-y-4">
            {/* Status banner */}
            <div
              className={`flex items-start gap-3 rounded-2xl border p-5 ${
                result.success
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  result.success
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <XCircle className="h-6 w-6" />
                )}
              </div>
              <div className="flex-1">
                <h3
                  className={`text-base font-bold ${
                    result.success ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {result.success ? "Conexión exitosa" : "Error de conexión"}
                </h3>
                <p className="mt-0.5 text-sm text-zinc-300">
                  {String(result.message || result.error || "Resultado de la prueba")}
                </p>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* HTTP Status */}
              {Boolean(result.httpStatus !== undefined) && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider">
                    <Server className="h-3.5 w-3.5" />
                    HTTP Status
                  </div>
                  <div
                    className={`mt-1.5 text-2xl font-black ${
                      (result.httpStatus ?? 0) >= 200 && (result.httpStatus ?? 0) < 300
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {result.httpStatus ?? "—"}
                  </div>
                </div>
              )}

              {/* API Key status */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider">
                  <KeyRound className="h-3.5 w-3.5" />
                  API Key (EVSES_API_KEY)
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {result.success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">
                        Configurada y válida
                      </span>
                    </>
                  ) : result.httpStatus === 401 || result.httpStatus === 403 ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                      <span className="text-sm font-semibold text-amber-400">
                        Rechazada por Eveses
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-400" />
                      <span className="text-sm font-semibold text-red-400">
                        No verificada
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Wallet balance */}
              {Boolean(result.wallet) && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Wallet de Eveses
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {result.wallet?.balance_cents !== null && result.wallet?.balance_cents !== undefined && (
                      <div>
                        <span className="text-xs text-zinc-500">Balance: </span>
                        <span className="font-mono text-sm font-bold text-white">
                          {result.wallet.balance_cents !== null
                            ? `${((result.wallet?.balance_cents ?? 0) / 100).toFixed(2)}`
                            : "—"}
                        </span>
                      </div>
                    )}
                    {result.wallet?.currency && (
                      <div>
                        <span className="text-xs text-zinc-500">Moneda: </span>
                        <span className="font-mono text-sm font-bold text-white">
                          {result.wallet?.currency}
                        </span>
                      </div>
                    )}
                    {Boolean(result.rawKeys && result.rawKeys.length > 0) && (
                      <div>
                        <span className="text-xs text-zinc-500">Campos: </span>
                        <span className="font-mono text-xs text-zinc-300">
                          {result.rawKeys?.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Error details */}
            {!result.success && Boolean(result.detail || result.evesesResponse) && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Detalles del error
                </div>
                {Boolean(result.detail) && (
                  <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all mb-2">
                    {String(result.detail)}
                  </pre>
                )}
                {Boolean(result.evesesResponse) && (
                  <>
                    <div className="flex items-center justify-between mt-3 mb-1">
                      <span className="text-xs text-zinc-500">Respuesta de Eveses:</span>
                      <button
                        onClick={() => setShowFullResponse(!showFullResponse)}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                      >
                        {showFullResponse ? (
                          <>
                            <EyeOff className="h-3 w-3" /> Ocultar
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" /> Mostrar
                          </>
                        )}
                      </button>
                    </div>
                    {showFullResponse && (
                      <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap break-all bg-zinc-950/60 rounded-lg p-3 border border-zinc-800 mt-1">
                        {JSON.stringify(result.evesesResponse, null, 2)}
                      </pre>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer note */}
        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-600">
            Esta página es solo para diagnóstico. La API Key nunca se muestra ni se envía al navegador.
          </p>
        </div>
      </div>
    </div>
  );
}
