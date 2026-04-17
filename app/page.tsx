"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, Trash2, TrendingUp, DollarSign, Activity } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

const chartData = [
  { date: 'Jan', actual: 2.1, forecast: null },
  { date: 'Feb', actual: 2.8, forecast: null },
  { date: 'Mar', actual: 3.4, forecast: 3.4 },
  { date: 'Apr', actual: null, forecast: 4.1 },
]

export default function PremiumAdsDashboard(){
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">📊 Ads Analytics Dashboard</h1>
            <p className="text-slate-400 mt-1">Premium BI style redesign</p>
          </div>
          <div className="flex gap-3">
            <Input type="file" className="max-w-xs bg-slate-900 border-slate-700" />
            <Button className="rounded-2xl"><Upload className="w-4 h-4 mr-2"/>Upload</Button>
            <Button variant="destructive" className="rounded-2xl"><Trash2 className="w-4 h-4 mr-2"/>Clear</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            ['Next ROI','4.12x',TrendingUp],
            ['Trend','+0.28',Activity],
            ['Recommended Spend','$12,500',DollarSign],
          ].map(([title,val,Icon]:any)=>(
            <Card key={title} className="bg-white/5 border-white/10 backdrop-blur-xl rounded-3xl">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">{title}</p>
                  <p className="text-3xl font-bold mt-2">{val}</p>
                </div>
                <div className="p-3 rounded-2xl bg-white/10"><Icon className="w-6 h-6"/></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-3xl">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">ROI Forecast</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Line dataKey="actual" strokeWidth={3} stroke="#3b82f6" />
                  <Line dataKey="forecast" strokeWidth={3} strokeDasharray="6 6" stroke="#ec4899" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-3xl">
          <CardContent className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/10 text-slate-300">
                <tr>
                  {['Campaign','Geo','Spend','Clicks','ROI'].map(h=><th key={h} className="text-left p-4">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[1,2,3].map(i=>(
                  <tr key={i} className="border-t border-white/10 hover:bg-white/5 transition">
                    <td className="p-4">Campaign {i}</td>
                    <td className="p-4">UA</td>
                    <td className="p-4">$1,250</td>
                    <td className="p-4">845</td>
                    <td className="p-4 text-emerald-400">3.42x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
