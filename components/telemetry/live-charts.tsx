"use client"

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"

interface DataPoint {
  time: string
  value1: number
  value2: number
  value3?: number
}

interface LiveChartProps {
  title: string
  data: DataPoint[]
  line1Label: string
  line2Label?: string
  line3Label?: string
  line1Color: string
  line2Color?: string
  line3Color?: string
  unit1?: string
  unit2?: string
  unit3?: string
}

export function LiveChart({
  title,
  data,
  line1Label,
  line2Label,
  line3Label,
  line1Color,
  line2Color,
  line3Color,
  unit1 = "",
  unit2 = "",
  unit3 = ""
}: LiveChartProps) {
  // Use explicit red, blue, green colors as defaults if not provided
  const redColor = line1Color || "#ef4444"
  const blueColor = line2Color || "#3b82f6"
  const greenColor = line3Color || "#10b981"
  
  return (
    <div className="h-full flex flex-col min-h-[100px]">
      <div className="flex items-center justify-between mb-1 md:mb-3">
        <h3 className="text-[10px] md:text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: redColor }} />
            <span className="text-muted-foreground font-medium">{line1Label}</span>
          </div>
          {line2Label && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: blueColor }} />
              <span className="text-muted-foreground font-medium">{line2Label}</span>
            </div>
          )}
          {line3Label && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: greenColor }} />
              <span className="text-muted-foreground font-medium">{line3Label}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1" style={{ minHeight: "80px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis
              dataKey="time"
              stroke="currentColor"
              className="text-muted-foreground"
              tick={{ fontSize: 10 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              yAxisId="left"
              stroke="currentColor"
              className="text-muted-foreground"
              tick={{ fontSize: 10 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="currentColor"
              className="text-muted-foreground"
              tick={{ fontSize: 10 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              hide
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px"
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number, name: string) => {
                const unit = name === line1Label ? unit1 : (name === line2Label ? unit2 : unit3)
                const color = name === line1Label ? redColor : (name === line2Label ? blueColor : greenColor)
                return [`${value.toFixed(1)}${unit}`, name]
              }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="value1"
              name={line1Label}
              stroke={redColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: redColor }}
              isAnimationActive={false}
            />
            {line2Label && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="value2"
                name={line2Label}
                stroke={blueColor}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: blueColor }}
                isAnimationActive={false}
              />
            )}
            {line3Label && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="value3"
                name={line3Label}
                stroke={greenColor}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: greenColor }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
