"use client";

import React, { useRef, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ForecastSplitChartProps {
  labels: string[];
  forecastStartIndex: number; // Index where forecast begins
  historicalData: number[];
  forecastData: number[];
  zoneName: string;
}

export default function ForecastSplitChart({
  labels,
  forecastStartIndex,
  historicalData,
  forecastData,
  zoneName
}: ForecastSplitChartProps) {
  // Construct aligned historical series (nulls during forecast)
  const fullHistorical = labels.map((_, i) => {
    if (i <= forecastStartIndex) return historicalData[i] ?? null;
    return null;
  });

  // Construct aligned forecast series (starts at boundary with last historical value to form continuous line)
  const fullForecast = labels.map((_, i) => {
    if (i < forecastStartIndex) return null;
    if (i === forecastStartIndex) return historicalData[forecastStartIndex] ?? null;
    const forecastOffset = i - forecastStartIndex - 1;
    return forecastData[forecastOffset] ?? null;
  });

  // Custom vertical line plugin at forecast split boundary
  const verticalLinePlugin = {
    id: "forecastBoundaryLine",
    afterDraw: (chart: any) => {
      const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
      const xPos = x.getPixelForValue(forecastStartIndex);

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#C96100"; // Amber/Orange indicator
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.stroke();

      // Label at top of vertical line
      ctx.fillStyle = "#C96100";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Forecast Start", xPos, top + 14);
      ctx.restore();
    }
  };

  const data = {
    labels,
    datasets: [
      {
        label: `${zoneName} — Historical Demand (Litres)`,
        data: fullHistorical,
        borderColor: "#1F6FDB", // Solid blue line
        backgroundColor: "rgba(31, 111, 219, 0.08)",
        fill: true,
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#1F6FDB"
      },
      {
        label: `${zoneName} — Predicted Demand (Litres)`,
        data: fullForecast,
        borderColor: "#0867C4", // Blue dashed line
        borderDash: [6, 6],
        backgroundColor: "rgba(8, 103, 196, 0.04)",
        fill: true,
        borderWidth: 2.5,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#0867C4"
      }
    ]
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: "easeOutQuart"
    },
    plugins: {
      legend: {
        position: "top" as const,
        align: "end" as const,
        labels: {
          boxWidth: 14,
          font: { family: "Inter", size: 12 },
          color: "#0B1F3A"
        }
      },
      tooltip: {
        backgroundColor: "#012A5C",
        titleFont: { family: "Inter", size: 12 },
        bodyFont: { family: "Inter", size: 13 },
        padding: 10,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw;
            if (val === null || val === undefined) return "";
            return `${ctx.dataset.label.split("—")[1] || ctx.dataset.label}: ${val.toLocaleString("en-IN")} L`;
          }
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: "Water Consumption (Litres)",
          font: { family: "Inter", size: 12 },
          color: "#5A6B8B"
        },
        grid: { color: "#EAF0F6" },
        ticks: { color: "#5A6B8B" }
      },
      x: {
        grid: { color: "#EAF0F6" },
        ticks: { color: "#5A6B8B" }
      }
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "300px" }}>
      <Line data={data} options={options} plugins={[verticalLinePlugin]} />
    </div>
  );
}
