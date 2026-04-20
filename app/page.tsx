"use client"
import { useTheme } from "next-themes"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
  Label,
} from "recharts"

// -----------------------------
// DATE FORMATTER
// -----------------------------
function formatMonth(dateStr: string) {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date)
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<any[]>([])
  const [forecast, setForecast] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [message, setMessage] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ==================== НОВАЯ ФУНКЦИЯ ПРОГРЕССА ====================
  const [initialLoading, setInitialLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState("Инициализация...")

  // -----------------------------
  // INITIAL LOADING WITH PROGRESS BAR
  // -----------------------------
  useEffect(() => {
    const loadWithProgress = async () => {
      setInitialLoading(true)
      setProgress(0)
      setLoadingText("Подключение...")

      try {
        // Этап 1
        setLoadingText("Загрузка данных кампаний...")
        setProgress(30)

        const { data: adsData } = await supabase
          .from("ads_data")
          .select("*")
          .order("created_at", { ascending: true })

        setData(adsData || [])

        // Этап 2
        setLoadingText("Подключение к серверу(чуток подожди, пж)...")
        setProgress(65)

        const res = await fetch("https://prognoz-mab2.onrender.com/forecast")
        
        if (res.ok) {
          const json = await res.json()
          setForecast(json)
        } else {
          console.warn("Forecast API не ответил")
        }

        // Этап 3
        setLoadingText("Подготовка интерфейса...")
        setProgress(90)

        // Небольшая пауза для плавности
        await new Promise(resolve => setTimeout(resolve, 400))

        setProgress(100)
        setLoadingText("Готово!")

        // Плавно скрываем экран загрузки
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

  // -----------------------------
  // DATA
  // -----------------------------
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

  // -----------------------------
  // FORECAST (SAFE)
  // -----------------------------
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

  // -----------------------------
  // UPLOAD
  // -----------------------------
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
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
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

  // -----------------------------
  // SAFE CHART DATA
  // -----------------------------
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

  return (
    <div className="min-h-screen bg-white dark:bg-[#0b0f1a] text-black dark:text-white">

      {/* ====================== PROGRESS OVERLAY ====================== */}
      {initialLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#0b0f1a]">

          <div className="w-full max-w-md px-6 md:px-8 text-center">

            <div className="mb-8">
              <div className="w-14 h-14 md:w-16 md:h-16 mx-auto border-4 border-gray-200 dark:border-white/10 border-t-indigo-500 rounded-full animate-spin" />
            </div>

            <h2 className="text-xl md:text-2xl font-semibold mb-2 tracking-tight">
              Загрузка страницы
            </h2>

            <p className="text-gray-600 dark:text-white/60 mb-6 md:mb-8 text-sm">
              {loadingText}
            </p>

            <div className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-xs font-mono text-gray-400 dark:text-white/50">
              {progress}%
            </p>

          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/80 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">

        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex flex-col lg:flex-row gap-4 lg:justify-between lg:items-center">

          <div>
            <h1 className="text-base md:text-lg font-semibold tracking-tight">
              Ads Analytics
            </h1>
            <p className="text-xs text-gray-500 dark:text-white/50">
              Performance & forecasting dashboard
            </p>
          </div>

          {/* FILE UPLOAD */}
          <div className="flex flex-wrap gap-2 md:gap-3 items-center">

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
              className="px-3 md:px-4 py-2 rounded-xl bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 border border-gray-300 dark:border-white/10 cursor-pointer text-sm"
            >
              Choose file
            </label>

            <div className="min-w-[140px] md:min-w-[180px] px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-600 dark:text-white/60 truncate">
              {file ? file.name : "No file selected"}
            </div>

            <button
              onClick={uploadFile}
              disabled={loading || !file}
              className="px-3 md:px-4 py-2 rounded-xl bg-indigo-500/90 hover:bg-indigo-500 disabled:opacity-40 text-sm text-white"
            >
              {loading ? "Uploading..." : "Upload"}
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
              disabled={forecastLoading}
              className="px-3 md:px-4 py-2 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 text-sm text-white"
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
              className="px-3 md:px-4 py-2 rounded-xl bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 border border-gray-300 dark:border-white/10 text-sm"
            >
              Clear
            </button>

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="px-3 py-2 rounded-xl bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 text-sm"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>


            

          </div>
        </div>
      </div>

      {/* MESSAGE */}
      {message && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4 text-xs text-gray-600 dark:text-white/60">
          {message}
        </div>
      )}

      {/* CONTENT */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* KPI */}
        {forecast && !forecastLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">

            {[
              { label: "Next ROI", value: forecast.next_month_roi?.toFixed(2) },
              { label: "Trend", value: forecast.roi_trend?.toFixed(4) },
              { label: "Recommended Spend", value: forecast.recommended_spend?.toFixed(2) },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 md:p-6 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10"
              >
                <p className="text-xs text-gray-500 dark:text-white/50">{item.label}</p>
                <p className="text-2xl md:text-3xl font-semibold mt-2">
                  {item.value}
                </p>
              </div>
            ))}

          </div>
        )}

        {/* LOADING STATE */}
        {forecastLoading && (
          <div className="text-gray-500 dark:text-white/40 text-sm">
            Loading forecast...
          </div>
        )}

        {/* CHART */}
        {forecast && (
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 md:p-6">

            <h2 className="text-base md:text-lg font-semibold mb-4">
              ROI Forecast Chart
            </h2>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" tickFormatter={formatMonth} />
                <YAxis />
                <Tooltip />
                <Legend />

                {lastActualDate && forecastDate && (
                  <ReferenceArea
                    x1={lastActualDate}
                    x2={forecastDate}
                    fill="#8b5cf6"
                    fillOpacity={0.15}
                  >
                    <Label value="Forecast" fill="#a78bfa" />
                  </ReferenceArea>
                )}

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>

          </div>
        )}

        {/* TABLE */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 overflow-hidden">

          <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between">
            <h2 className="font-semibold text-sm md:text-base">
              Campaigns
            </h2>
            <p className="text-xs text-gray-500 dark:text-white/40">
              {data.length} records
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm min-w-[900px]">

              <thead className="text-gray-500 dark:text-white/50 text-xs uppercase">
                <tr>
                  {["Campaign","Geo","Date","Spend","Clicks","Impr","CTR","CPA","ROI"].map(h => (
                    <th key={h} className="text-left px-3 md:px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                {data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-100 dark:hover:bg-white/5">

                    <td className="px-3 md:px-4 py-3">{row.campaign}</td>
                    <td className="px-3 md:px-4 py-3 text-gray-500 dark:text-white/60">{row.geo}</td>
                    <td className="px-3 md:px-4 py-3 text-gray-500 dark:text-white/60">
                      {formatMonth(row.date)}
                    </td>
                    <td className="px-3 md:px-4 py-3">{row.spend}</td>
                    <td className="px-3 md:px-4 py-3">{row.clicks}</td>
                    <td className="px-3 md:px-4 py-3">{row.impressions}</td>
                    <td className="px-3 md:px-4 py-3">{Number(row.ctr)?.toFixed(2)}</td>
                    <td className="px-3 md:px-4 py-3">{Number(row.cpa)?.toFixed(2)}</td>
                    <td className="px-3 md:px-4 py-3 text-indigo-500 font-semibold">
                      {Number(row.roi)?.toFixed(2)}
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>

        </div>

      </div>
    </div>
  )
}