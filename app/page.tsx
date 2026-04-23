"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  CartesianGrid,
  Label,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type AlertItem = {
  title: string
  text: string
  tone: "positive" | "warn" | "negative"
}

type CampaignHighlight = {
  campaign: string
  roi: number
  spend: number
  clicks: number
}

type ForecastData = {
  monthly?: Array<{ date: string; roi: number }>
  forecast_point?: { date: string; roi: number } | null
  next_month_roi?: number
  roi_trend?: number
  recommended_spend?: number
  comparison?: {
    current_period?: string | null
    previous_period?: string | null
    roi_delta?: number
    spend_delta?: number
    cpa_delta?: number
  }
  highlights?: {
    alerts?: AlertItem[]
    top_campaigns?: CampaignHighlight[]
    risk_campaigns?: CampaignHighlight[]
    recommendation?: {
      label: string
      text: string
    }
  }
}

function formatMonth(dateStr: string) {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function formatMetric(value?: number, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "--"
  return Number(value).toFixed(digits)
}

function formatCompactValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatDelta(value: number) {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "positive" | "accent"
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "accent"
        ? "border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
        : "border-black/10 bg-white/60 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"

  return (
    <div className={`rounded-2xl border px-4 py-3 backdrop-blur-xl ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  )
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<any[]>([])
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(false)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [initialLoading, setInitialLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState("Инициализация...")
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedGeo, setSelectedGeo] = useState("all")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const loadWithProgress = async () => {
      setInitialLoading(true)
      setProgress(0)
      setLoadingText("Подключение...")

      try {
        setLoadingText("Загрузка данных кампаний...")
        setProgress(30)

        const { data: adsData } = await supabase
          .from("ads_data")
          .select("*")
          .order("created_at", { ascending: true })

        setData(adsData || [])

        setLoadingText("Подключение к серверу(чуток подожди, пж)...")
        setProgress(65)

        const res = await fetch("https://prognoz-mab2.onrender.com/forecast")

        if (res.ok) {
          const json = await res.json()
          setForecast(json)
        } else {
          console.warn("Forecast API не ответил")
        }

        setLoadingText("Подготовка интерфейса...")
        setProgress(90)

        await new Promise((resolve) => setTimeout(resolve, 400))

        setProgress(100)
        setLoadingText("Готово!")

        setTimeout(() => {
          setInitialLoading(false)
        }, 500)
      } catch (error) {
        console.error("Ошибка загрузки:", error)
        setProgress(100)
        setTimeout(() => setInitialLoading(false), 600)
      }
    }

    loadWithProgress()
  }, [])

  async function fetchData() {
    try {
      const { data } = await supabase
        .from("ads_data")
        .select("*")
        .order("created_at", { ascending: true })
      setData(data || [])
    } catch {
      setData([])
    }
  }

  async function loadForecast() {
    setForecastLoading(true)
    try {
      const res = await fetch("https://prognoz-mab2.onrender.com/forecast")
      if (!res.ok) throw new Error("Forecast API error")
      const json = await res.json()
      setForecast(json)
    } catch (e) {
      console.log(e)
      setForecast(null)
    }
    setForecastLoading(false)
  }

  async function uploadFile() {
    if (!file) return setMessage("Select file")
    setLoading(true)
    const form = new FormData()
    form.append("file", file)

    try {
      const res = await fetch("https://prognoz-mab2.onrender.com/upload", {
        method: "POST",
        body: form,
      })
      const json = await res.json()

      if (json.status === "success") {
        setMessage(`Uploaded ${json.rows_inserted}`)
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
        fetchData()
        loadForecast()
      } else {
        setMessage("Upload failed")
      }
    } catch {
      setMessage("Server error")
    }

    setLoading(false)
  }

  const chartData =
    (forecast?.monthly || [])
      .filter((r: any) => r?.date && r?.roi !== undefined)
      .map((row: any) => ({
        date: row.date,
        value: Number(row.roi) || 0,
        type: "actual",
      })) || []

  if (forecast?.forecast_point?.date) {
    chartData.push({
      date: forecast.forecast_point.date,
      value: Number(forecast.forecast_point.roi) || 0,
      type: "forecast",
    })
  }

  const lastActualDate = forecast?.monthly?.at?.(-1)?.date
  const forecastDate = forecast?.forecast_point?.date
  const { theme, setTheme } = useTheme()

  const totalSpend = data.reduce((sum, row) => sum + (Number(row.spend) || 0), 0)
  const totalRevenue = data.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0)
  const totalClicks = data.reduce((sum, row) => sum + (Number(row.clicks) || 0), 0)
  const avgRoi = totalSpend ? totalRevenue / totalSpend : 0
  const geos = Array.from(new Set(data.map((row) => row.geo).filter(Boolean))).sort()

  const filteredData = data.filter((row) => {
    const matchesSearch =
      !search ||
      String(row.campaign || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    const matchesGeo = selectedGeo === "all" || row.geo === selectedGeo
    return matchesSearch && matchesGeo
  })

  const comparison = forecast?.comparison
  const highlights = forecast?.highlights
  const alerts: AlertItem[] = highlights?.alerts || []
  const topCampaigns: CampaignHighlight[] = highlights?.top_campaigns || []
  const riskCampaigns: CampaignHighlight[] = highlights?.risk_campaigns || []
  const recommendation = highlights?.recommendation || {
    label: "Hold",
    text: "Upload campaign data to receive recommendations.",
  }

  const surfaceClass =
    "border border-black/10 bg-white/70 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_30px_80px_rgba(2,6,23,0.55)]"
  const mutedText = "text-slate-600 dark:text-slate-300/70"

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_45%,_#f8fafc_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.14),_transparent_25%),linear-gradient(180deg,_#06101f_0%,_#0b1220_40%,_#050814_100%)] dark:text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-100">
        <div className="absolute left-[-8rem] top-[-5rem] h-72 w-72 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/20" />
        <div className="absolute right-[-4rem] top-24 h-80 w-80 rounded-full bg-orange-300/20 blur-3xl dark:bg-amber-400/10" />
        <div className="absolute bottom-[-8rem] left-1/3 h-80 w-80 rounded-full bg-fuchsia-300/15 blur-3xl dark:bg-cyan-400/10" />
      </div>

      {initialLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-2xl">
          <div className={`w-full max-w-lg rounded-[2rem] p-8 text-center ${surfaceClass}`}>
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-[conic-gradient(from_180deg_at_50%_50%,#0ea5e9,transparent,#f97316,transparent,#0ea5e9)] p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white/90 dark:bg-slate-950/90">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500 dark:border-white/10 dark:border-t-sky-400" />
              </div>
            </div>

            <p className="text-[11px] uppercase tracking-[0.35em] text-sky-600 dark:text-sky-300">
              Live Analytics Boot
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Поднимаем дашборд</h2>
            <p className={`mt-3 text-sm ${mutedText}`}>{loadingText}</p>

            <div className="mt-8 overflow-hidden rounded-full bg-slate-200/80 p-1 dark:bg-white/10">
              <div
                className="h-3 rounded-full bg-[linear-gradient(90deg,#0ea5e9_0%,#38bdf8_35%,#fb923c_100%)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 border-b border-black/5 bg-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-lg shadow-lg shadow-sky-500/10 dark:border-white/10 dark:bg-white/10">
              A
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-sky-700 dark:text-sky-300">
                Forecast Studio
              </p>
              <h1 className="text-lg font-semibold tracking-tight md:text-xl">Ads Analytics Command</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              {!mounted ? "Theme" : theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {forecastLoading ? "Syncing forecast..." : "System online"}
            </div>
          </div>
        </div>
      </div>

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div className={`relative overflow-hidden rounded-[2rem] p-6 md:p-8 ${surfaceClass}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.12),_transparent_25%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.14),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.12),_transparent_25%)]" />
            <div className="relative">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[11px] uppercase tracking-[0.4em] text-sky-700 dark:text-sky-300">
                    Media Buying Intelligence
                  </p>
                  <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-6xl">
                    Центр управления рекламной аналитикой.
                  </h2>
                  <p className={`mt-4 max-w-xl text-sm leading-6 md:text-base ${mutedText}`}>
                    Платформа для медиабаинга, где данные по кампаниям, прогноз ROI и
                    решения по бюджету собираются в одном месте, чтобы быстрее находить
                    рабочие связки и уверенно увеличивать объёмы.
                  </p>
                </div>

                <div className="grid w-full max-w-xs grid-cols-2 gap-3">
                  <StatPill label="Campaigns" value={String(data.length)} />
                  <StatPill label="Avg ROI" value={formatMetric(avgRoi)} tone="accent" />
                  <StatPill label="Spend" value={formatCompactValue(totalSpend)} />
                  <StatPill label="Clicks" value={formatCompactValue(totalClicks)} tone="positive" />
                </div>
              </div>

              <div className="mt-8 grid gap-3 xl:grid-cols-[1.1fr_1fr_auto_auto_auto]">
                <input
                  ref={fileInputRef}
                  id="fileInput"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                <label
                  htmlFor="fileInput"
                  className="group flex min-h-[72px] cursor-pointer items-center justify-between rounded-[1.5rem] border border-dashed border-black/15 bg-white/65 px-5 py-4 transition hover:-translate-y-0.5 hover:border-sky-400/50 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-400/40 dark:hover:bg-white/10"
                >
                  <div>
                    <p className="text-sm font-medium">Choose CSV file</p>
                    <p className={`mt-1 text-xs ${mutedText}`}>Upload fresh campaign metrics</p>
                  </div>
                </label>

                <div className="flex min-h-[72px] items-center rounded-[1.5rem] border border-black/10 bg-white/65 px-5 py-4 text-sm dark:border-white/10 dark:bg-white/5">
                  <div>
                    <p className="font-medium">Selected file</p>
                    <p className={`mt-1 max-w-[240px] truncate text-xs ${mutedText}`}>
                      {file ? file.name : "No file selected yet"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={uploadFile}
                  disabled={loading || !file}
                  className="min-h-[72px] rounded-[1.5rem] bg-[linear-gradient(135deg,#0ea5e9_0%,#0369a1_100%)] px-5 py-4 text-sm font-medium text-white shadow-[0_20px_50px_rgba(14,165,233,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_25px_60px_rgba(14,165,233,0.45)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Uploading..." : "Upload data"}
                </button>

                <button
                  onClick={() => {
                    if (forecastLoading) return
                    if (!forecast?.monthly?.length) {
                      setMessage("⚠️ First upload data to generate forecast")
                      return
                    }
                    window.open("https://prognoz-mab2.onrender.com/export", "_blank")
                  }}
                  disabled={forecastLoading || !forecast?.monthly?.length}
                  className="min-h-[72px] rounded-[1.5rem] bg-[linear-gradient(135deg,#22c55e_0%,#15803d_100%)] px-5 py-4 text-sm font-medium text-white shadow-[0_20px_50px_rgba(34,197,94,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_25px_60px_rgba(34,197,94,0.38)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {forecastLoading ? "Preparing..." : "Export Excel"}
                </button>


                <button
                  onClick={async () => {
                    await fetch("https://prognoz-mab2.onrender.com/clear", {
                      method: "POST",
                    })
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                    loadForecast()
                    fetchData()
                  }}
                  className="min-h-[72px] rounded-[1.5rem] border border-black/10 bg-white/70 px-5 py-4 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  Clear data
                </button>
              </div>

              {message && (
                <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
                  {message}
                </div>
              )}

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <div className="rounded-[1.5rem] border border-black/10 bg-white/65 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <p className={`text-xs uppercase tracking-[0.22em] ${mutedText}`}>Search campaigns</p>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type campaign name..."
                    className="mt-2 w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="rounded-[1.5rem] border border-black/10 bg-white/65 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <p className={`text-xs uppercase tracking-[0.22em] ${mutedText}`}>Geo filter</p>
                  <select
                    value={selectedGeo}
                    onChange={(e) => setSelectedGeo(e.target.value)}
                    className="mt-2 w-full bg-transparent text-sm outline-none"
                  >
                    <option value="all">All geos</option>
                    {geos.map((geo) => (
                      <option key={geo} value={geo}>
                        {geo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center rounded-[1.5rem] border border-black/10 bg-white/65 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
                  {filteredData.length} filtered rows
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className={`rounded-[2rem] p-6 ${surfaceClass}`}>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                Forecast Snapshot
              </p>
              <div className="mt-6 space-y-5">
                {[
                  {
                    label: "Next ROI",
                    value: formatMetric(forecast?.next_month_roi),
                    note: "predicted next period outcome",
                  },
                  {
                    label: "Trend",
                    value: formatMetric(forecast?.roi_trend, 4),
                    note: "direction and momentum",
                  },
                  {
                    label: "Recommended Spend",
                    value: formatMetric(forecast?.recommended_spend),
                    note: "budget suggestion from model",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.5rem] border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-xs uppercase tracking-[0.24em] ${mutedText}`}>{item.label}</p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-[radial-gradient(circle,#0ea5e9,transparent_70%)] opacity-80 dark:bg-[radial-gradient(circle,#fb923c,transparent_70%)]" />
                    </div>
                    <p className={`mt-3 text-xs ${mutedText}`}>{item.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-[2rem] p-6 ${surfaceClass}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                    Data Health
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">Live ingest status</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(249,115,22,0.16))]" />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className={`text-xs uppercase tracking-[0.22em] ${mutedText}`}>Rows</p>
                  <p className="mt-2 text-2xl font-semibold">{data.length}</p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className={`text-xs uppercase tracking-[0.22em] ${mutedText}`}>Forecast</p>
                  <p className="mt-2 text-2xl font-semibold">{forecast ? "Ready" : "Waiting"}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <p className={`text-xs uppercase tracking-[0.22em] ${mutedText}`}>Current mode</p>
                <p className="mt-2 text-lg font-medium">
                  {theme === "dark" ? "Dark cinematic workspace" : "Light editorial workspace"}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <p className={`text-xs uppercase tracking-[0.22em] ${mutedText}`}>Recommendation</p>
                <p className="mt-2 text-2xl font-semibold">{recommendation.label}</p>
                <p className={`mt-2 text-sm ${mutedText}`}>{recommendation.text}</p>
              </div>
            </div>
          </div>
        </section>

        {forecastLoading && (
          <div className={`rounded-[1.75rem] px-5 py-4 text-sm ${surfaceClass}`}>
            <span className={mutedText}>Loading forecast...</span>
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <div className={`rounded-[2rem] p-5 md:p-6 ${surfaceClass}`}>
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                  Projection Curve
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  ROI forecast trajectory
                </h3>
              </div>
              <p className={`max-w-md text-sm ${mutedText}`}>
                Фактические показатели плавно переходят в прогнозный участок, чтобы переход был
                читаемым и визуально дорогим.
              </p>
            </div>

            {forecast ? (
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={chartData} margin={{ top: 20, right: 12, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="55%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#fb923c" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="4 10" stroke="currentColor" opacity={0.12} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatMonth}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "#94a3b8" : "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === "dark" ? "#94a3b8" : "#475569", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 20,
                      border: theme === "dark" ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.08)",
                      background: theme === "dark" ? "rgba(9,14,26,0.94)" : "rgba(255,255,255,0.94)",
                      backdropFilter: "blur(16px)",
                    }}
                    labelFormatter={(value) => formatMonth(String(value))}
                  />
                  <Legend />

                  {lastActualDate && forecastDate && (
                    <ReferenceArea
                      x1={lastActualDate}
                      x2={forecastDate}
                      fill="#fb923c"
                      fillOpacity={0.12}
                    >
                      <Label value="Forecast zone" fill={theme === "dark" ? "#fdba74" : "#c2410c"} />
                    </ReferenceArea>
                  )}

                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="url(#lineStroke)"
                    strokeWidth={4}
                    dot={{ r: 3, fill: "#0ea5e9" }}
                    activeDot={{ r: 6, fill: "#fb923c" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[380px] items-center justify-center rounded-[1.5rem] border border-dashed border-black/10 bg-white/50 text-center dark:border-white/10 dark:bg-white/5">
                <div>
                  <p className="text-lg font-medium">Forecast not available yet</p>
                  <p className={`mt-2 text-sm ${mutedText}`}>Upload campaign data to unlock the chart.</p>
                </div>
              </div>
            )}
          </div>

          <div className={`rounded-[2rem] p-5 md:p-6 ${surfaceClass}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                  Quick Read
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Executive highlights</h3>
              </div>
              <div className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] dark:border-white/10">
                Overview
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
                <p className={`text-xs uppercase tracking-[0.22em] ${mutedText}`}>ROI outlook</p>
                <p className="mt-3 text-xl font-semibold leading-snug">
                  {forecast
                    ? `Next expected ROI is ${formatMetric(forecast.next_month_roi)} with a trend of ${formatMetric(forecast.roi_trend, 4)}.`
                    : "The model is waiting for a valid forecast payload."}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
                <p className={`text-xs uppercase tracking-[0.22em] ${mutedText}`}>Budget cue</p>
                <p className="mt-3 text-xl font-semibold leading-snug">
                  {forecast
                    ? `Recommended spend lands at ${formatMetric(forecast.recommended_spend)} for the next optimization cycle.`
                    : "Budget guidance will appear after the forecast is generated."}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
                <p className={`text-xs uppercase tracking-[0.22em] ${mutedText}`}>Dataset pulse</p>
                <p className="mt-3 text-xl font-semibold leading-snug">
                  {data.length
                    ? `${data.length} rows are loaded, with ${formatCompactValue(totalClicks)} clicks and ${formatCompactValue(totalSpend)} total spend in view.`
                    : "No campaign rows loaded yet."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
          <div className={`rounded-[2rem] p-5 md:p-6 ${surfaceClass}`}>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
              Alert Center
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">What needs attention</h3>
            <div className="mt-5 space-y-3">
              {alerts.length ? (
                alerts.map((alert: AlertItem) => (
                  <div
                    key={alert.title}
                    className={`rounded-[1.35rem] border px-4 py-4 ${
                      alert.tone === "positive"
                        ? "border-emerald-400/25 bg-emerald-500/10"
                        : alert.tone === "warn"
                          ? "border-amber-400/25 bg-amber-500/10"
                          : "border-rose-400/25 bg-rose-500/10"
                    }`}
                  >
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className={`mt-1 text-sm ${mutedText}`}>{alert.text}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-black/10 bg-white/60 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-sm font-semibold">No major issues detected</p>
                  <p className={`mt-1 text-sm ${mutedText}`}>Current dataset looks stable enough for regular monitoring.</p>
                </div>
              )}
            </div>
          </div>

          <div className={`rounded-[2rem] p-5 md:p-6 ${surfaceClass}`}>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
              Top Campaigns
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Best ROI performers</h3>
            <div className="mt-5 space-y-3">
              {topCampaigns.map((campaign: CampaignHighlight, index: number) => (
                <div key={campaign.campaign} className="rounded-[1.35rem] border border-black/10 bg-white/60 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">Top {index + 1}</p>
                      <p className="mt-2 text-lg font-semibold">{campaign.campaign}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">{formatMetric(campaign.roi)}</p>
                      <p className={`text-xs ${mutedText}`}>ROI</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-[2rem] p-5 md:p-6 ${surfaceClass}`}>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
              Risk Campaigns
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Need review first</h3>
            <div className="mt-5 space-y-3">
              {riskCampaigns.map((campaign: CampaignHighlight, index: number) => (
                <div key={campaign.campaign} className="rounded-[1.35rem] border border-black/10 bg-white/60 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-rose-600 dark:text-rose-300">Risk {index + 1}</p>
                      <p className="mt-2 text-lg font-semibold">{campaign.campaign}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-rose-600 dark:text-rose-300">{formatMetric(campaign.roi)}</p>
                      <p className={`text-xs ${mutedText}`}>ROI</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          {[
            {
              label: "ROI vs previous period",
              value: formatDelta(Number(comparison?.roi_delta || 0)),
              note:
                comparison?.current_period && comparison?.previous_period
                  ? `${formatMonth(comparison.previous_period)} to ${formatMonth(comparison.current_period)}`
                  : "Need at least 2 periods",
            },
            {
              label: "Spend vs previous period",
              value: formatDelta(Number(comparison?.spend_delta || 0)),
              note: "Budget movement",
            },
            {
              label: "CPA vs previous period",
              value: formatDelta(Number(comparison?.cpa_delta || 0)),
              note: "Efficiency movement",
            },
          ].map((item) => (
            <div key={item.label} className={`rounded-[2rem] p-5 md:p-6 ${surfaceClass}`}>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                Period Comparison
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{item.label}</h3>
              <p className="mt-5 text-4xl font-semibold tracking-tight">{item.value}</p>
              <p className={`mt-2 text-sm ${mutedText}`}>{item.note}</p>
            </div>
          ))}
        </section>

        <section className={`overflow-hidden rounded-[2rem] ${surfaceClass}`}>
          <div className="flex flex-col gap-3 border-b border-black/5 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6 dark:border-white/10">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                Raw Campaign Data
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Campaigns</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-black/10 px-4 py-2 text-sm dark:border-white/10">
                {filteredData.length} records
              </div>
              <div className={`text-sm ${mutedText}`}>Detailed table with hover focus</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-black/[0.03] text-left text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                <tr>
                  {["Campaign", "Geo", "Date", "Spend", "Clicks", "Impr", "CTR", "CPA", "ROI"].map((heading) => (
                    <th key={heading} className="px-4 py-4 font-medium md:px-6">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredData.map((row) => (
                  <tr
                    key={row.id}
                    className="group bg-white/20 transition hover:bg-sky-500/[0.06] dark:bg-transparent dark:hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-4 font-medium text-slate-900 md:px-6 dark:text-white">
                      {row.campaign}
                    </td>
                    <td className={`px-4 py-4 md:px-6 ${mutedText}`}>{row.geo}</td>
                    <td className={`px-4 py-4 md:px-6 ${mutedText}`}>{formatMonth(row.date)}</td>
                    <td className="px-4 py-4 md:px-6">{row.spend}</td>
                    <td className="px-4 py-4 md:px-6">{row.clicks}</td>
                    <td className="px-4 py-4 md:px-6">{row.impressions}</td>
                    <td className="px-4 py-4 md:px-6">{Number(row.ctr)?.toFixed(2)}</td>
                    <td className="px-4 py-4 md:px-6">{Number(row.cpa)?.toFixed(2)}</td>
                    <td className="px-4 py-4 font-semibold text-sky-700 md:px-6 dark:text-sky-300">
                      {Number(row.roi)?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
