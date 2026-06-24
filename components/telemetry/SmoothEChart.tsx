"use client";

import React, { useEffect, useRef } from "react";

// For typescript definitions, we assume echarts is installed by the user.
// Since we are running in a Next.js environment, we load echarts dynamically or safely import it.
let echarts: any = null;
if (typeof window !== "undefined") {
  // ECharts will be imported on the client side
  import("echarts").then((mod) => {
    echarts = (mod as any).default || mod;
  }).catch((err) => {
    console.warn("ECharts library not loaded yet. Make sure to run 'npm install echarts' to enable live charts.", err);
  });
}

interface SmoothEChartProps {
  title: string;
  dataKey: string;
  color: string;
  unit: string;
  currentValue: number;
  limitValue?: number;
  bufferSize?: number; // Ring buffer capacity (default 150 points)
  yMin?: number;
  yMax?: number;
}

export default function SmoothEChart({
  title,
  dataKey,
  color,
  unit,
  currentValue,
  limitValue,
  bufferSize = 150,
  yMin = 0,
  yMax = 100,
}: SmoothEChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<any>(null);
  const dataBufferRef = useRef<{ name: string; value: [number, number] }[]>([]);
  const indexRef = useRef<number>(0);

  // Initialize ECharts instance on mount
  useEffect(() => {
    if (typeof window === "undefined" || !chartRef.current) return;

    // Check if echarts module is loaded, otherwise wait and try again
    const initChart = () => {
      if (!echarts) {
        setTimeout(initChart, 100);
        return;
      }

      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
      }

      // Initialize with Canvas Renderer for hardware-accelerated drawing
      chartInstanceRef.current = echarts.init(chartRef.current, "dark", {
        renderer: "canvas", // ECharts can also use 'webgl' for extremely large grids
        useDirtyRect: true, // Optimizes paint cycles by only drawing dirty rectangles
      });

      // Exact high-performance, non-blocking chart configuration
      const option = {
        backgroundColor: "transparent", // Blends with dashboard theme
        grid: {
          left: "4%",
          right: "4%",
          top: "15%",
          bottom: "10%",
          containLabel: true,
        },
        xAxis: {
          type: "value",
          boundaryGap: false,
          splitLine: { show: false },
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { show: false },
        },
        yAxis: {
          type: "value",
          min: yMin,
          max: yMax,
          splitLine: {
            lineStyle: {
              color: "rgba(63, 63, 70, 0.2)", // Sleek gridlines matching dark mode
              type: "dashed",
            },
          },
          axisLabel: {
            color: "#71717a",
            fontFamily: "monospace",
            fontSize: 9,
          },
        },
        // Disable default heavy hover animations & tooltips to preserve CPU
        tooltip: { show: false },
        legend: { show: false },
        // Hardware acceleration and performance tweaks
        progressive: 2000,
        progressiveThreshold: 3000,
        animation: false, // Critical: Disable animations entirely for 50Hz+ real-time updates!
        series: [
          {
            name: title,
            type: "line",
            showSymbol: false,
            sampling: "lttb", // Downsamples data in real time for heavy loads
            hoverAnimation: false, // Critical: Prevent recalculating charts on mouse moves
            lineStyle: {
              width: 2,
              color: color,
              shadowBlur: 8,
              shadowColor: color,
            },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${color}25` }, // Glowing fade effect
                  { offset: 1, color: "transparent" },
                ],
              },
            },
            data: [],
          },
          // Conditional limit line
          ...(limitValue !== undefined
            ? [
                {
                  type: "line",
                  symbol: "none",
                  lineStyle: {
                    color: "rgba(239, 68, 68, 0.6)",
                    type: "dashed",
                    width: 1.5,
                  },
                  data: [
                    [0, limitValue],
                    [bufferSize, limitValue],
                  ],
                },
              ]
            : []),
        ],
      };

      chartInstanceRef.current.setOption(option);
    };

    initChart();

    // Auto-resizing support on widget resize
    const handleResize = () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.resize();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
      }
    };
  }, [color, title, limitValue, yMin, yMax, bufferSize]);

  // Feed real-time data into the ring buffer
  useEffect(() => {
    if (!chartInstanceRef.current) return;

    const buffer = dataBufferRef.current;
    const nowIndex = indexRef.current;

    // Append to ring buffer
    buffer.push({
      name: String(nowIndex),
      value: [nowIndex, currentValue],
    });

    // Enforce ring-buffer maximum limit
    if (buffer.length > bufferSize) {
      buffer.shift();
    }

    indexRef.current = nowIndex + 1;

    // Fast partial update: updating only the data series avoiding a full layout re-rendering
    chartInstanceRef.current.setOption(
      {
        series: [
          {
            data: buffer.map((item) => item.value),
          },
          // Maintain limit line alignment
          ...(limitValue !== undefined
            ? [
                {
                  data: [
                    [Math.max(0, nowIndex - bufferSize), limitValue],
                    [nowIndex, limitValue],
                  ],
                },
              ]
            : []),
        ],
      },
      { notMerge: false, lazyUpdate: true }
    );
  }, [currentValue, bufferSize, limitValue]);

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] border border-[#1a1a1a] rounded-lg p-3 hover:border-[#333] transition-colors relative overflow-hidden group">
      {/* Title & Real-Time Readout */}
      <div className="flex justify-between items-start mb-1 z-10">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold font-mono text-zinc-300 tracking-widest uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            {title}
          </span>
          {limitValue !== undefined && (
            <span className="text-[9px] font-mono text-red-500/80 mt-0.5">
              LIMIT: {limitValue} {unit}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-extrabold font-mono text-white tracking-tight">
            {currentValue.toFixed(currentValue > 100 ? 0 : 2)}
          </span>
          <span className="text-[9px] font-mono text-zinc-500 font-bold">{unit}</span>
        </div>
      </div>

      {/* Optimized Canvas Container */}
      <div className="flex-1 w-full min-h-[70px] relative mt-1">
        <div ref={chartRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
}
