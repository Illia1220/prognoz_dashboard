"use client"

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

  useEffect(() => {
    fetchData()
    loadForecast()
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

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">

      {/* TOP BAR */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">

          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Ads Analytics
            </h1>
            <p className="text-xs text-white/50">
              Performance & forecasting dashboard
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            <label className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 cursor-pointer">
              Choose file
            </label>

            <div className="min-w-[180px] px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 truncate">
              {file ? file.name : "No file selected"}
            </div>

            <button
              onClick={uploadFile}
              disabled={loading || !file}
              className="px-4 py-2 rounded-xl bg-indigo-500/80 hover:bg-indigo-500 disabled:opacity-40"
            >
              {loading ? "Uploading..." : "Upload"}
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
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="max-w-6xl mx-auto px-6 pt-4 text-xs text-white/60">
          {message}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* KPI */}
        {forecast && !forecastLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { label: "Next ROI", value: forecast.next_month_roi?.toFixed(2) },
              { label: "Trend", value: forecast.roi_trend?.toFixed(4) },
              { label: "Recommended Spend", value: forecast.recommended_spend?.toFixed(2) },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl p-6 bg-white/5 border border-white/10">
                <p className="text-xs text-white/50">{item.label}</p>
                <p className="text-3xl font-semibold mt-2">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {forecastLoading && (
          <div className="text-white/40 text-sm">Loading forecast...</div>
        )}

        {/* CHART */}
        {forecast && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">

            {/* 👇 ДОБАВЛЕН ЗАГОЛОВОК */}
            <h2 className="text-lg font-semibold mb-4">
              ROI Forecast Chart
            </h2>

            <ResponsiveContainer width="100%" height={360}>
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
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex justify-between">
            <h2 className="font-semibold">Campaigns</h2>
            <p className="text-xs text-white/40">{data.length} records</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/50 text-xs uppercase">
                <tr>
                  {["Campaign","Geo","Date","Spend","Clicks","Impr","CTR","CPA","ROI"].map(h => (
                    <th key={h} className="text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {data.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">{row.campaign}</td>
                    <td className="px-4 py-3 text-white/60">{row.geo}</td>
                    <td className="px-4 py-3 text-white/60">{formatMonth(row.date)}</td>
                    <td className="px-4 py-3">{row.spend}</td>
                    <td className="px-4 py-3">{row.clicks}</td>
                    <td className="px-4 py-3">{row.impressions}</td>
                    <td className="px-4 py-3">{Number(row.ctr)?.toFixed(2)}</td>
                    <td className="px-4 py-3">{Number(row.cpa)?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-indigo-400 font-semibold">
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