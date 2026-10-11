"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { INITIAL_ZONES, INITIAL_USER, ROLE_PRESETS, Zone, UserProfile } from "@/lib/data";
import { JalsetuMath } from "@/lib/math";
import AnimatedKpiValue from "@/components/AnimatedKpiValue";
import ForecastSplitChart from "@/components/ForecastSplitChart";

// Dynamically import Leaflet component with SSR disabled
const InteractiveRiskMap = dynamic(() => import("@/components/InteractiveRiskMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "420px", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7FAFB", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
      <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Loading City GIS Spatial Network...</span>
    </div>
  )
});

interface TelemetryResponse {
  zones: Zone[];
  series: {
    labels: string[];
    forecastStartIndex: number;
    profiles: Record<string, { historical: number[]; forecast: number[] }>;
  };
  transferRoutes: Array<{
    id: string;
    fromZoneId: string;
    fromName: string;
    fromCoords: [number, number];
    toZoneId: string;
    toName: string;
    toCoords: [number, number];
    transferVolume: number;
    status: string;
  }>;
}

export default function JalsetuApp() {
  const [activeView, setActiveView] = useState<string>("home");
  const [zones, setZones] = useState<Zone[]>(INITIAL_ZONES);
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USER);
  const [selectedCity, setSelectedCity] = useState("Thane");
  const [selectedHorizon, setSelectedHorizon] = useState("24h");
  const [selectedZoneFilter, setSelectedZoneFilter] = useState("all");
  const [totalAvailableSupply, setTotalAvailableSupply] = useState(1620000);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedLoginRole, setSelectedLoginRole] = useState<"operator" | "analyst">("operator");
  const [loginEmail, setLoginEmail] = useState(INITIAL_USER.email);

  // Advanced Map Simulation & Real Telemetry States
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [simulationActive, setSimulationActive] = useState(false);
  const [selectedMapZone, setSelectedMapZone] = useState<Zone | null>(INITIAL_ZONES[1]); // Default to Zone B
  const [isLoadingApi, setIsLoadingApi] = useState(true);

  // Anomaly & Shortage Filters/Sorting States
  const [anomalySeverityFilter, setAnomalySeverityFilter] = useState<string>("all");
  const [shortageRiskFilter, setShortageRiskFilter] = useState<string>("all");
  const [shortageSortAsc, setShortageSortAsc] = useState<boolean>(false);

  // Fetch real telemetry from backend API route
  useEffect(() => {
    async function loadTelemetry() {
      try {
        setIsLoadingApi(true);
        const res = await fetch(`/api/telemetry?horizon=${selectedHorizon}&supply=${totalAvailableSupply}`);
        if (res.ok) {
          const data = await res.json();
          setTelemetry(data);
          if (data.zones) setZones(data.zones);
        }
      } catch (err) {
        console.warn("Using embedded fallback telemetry", err);
      } finally {
        setIsLoadingApi(false);
      }
    }
    loadTelemetry();
  }, [selectedHorizon, totalAvailableSupply]);

  // Totals
  const totalDemand = zones.reduce((s, z) => s + z.predictedDemand, 0);
  const totalCurrentSupply = zones.reduce((s, z) => s + z.availableSupply, 0);
  const totalShortage = zones.reduce((s, z) => s + JalsetuMath.calculateShortage(z.predictedDemand, z.availableSupply), 0);

  // Redistribution calculation
  const redistributionPlan = JalsetuMath.redistributeSupply(zones, totalAvailableSupply);

  // Active chart zone profile
  const activeZoneKey = selectedZoneFilter === "all" ? "zone-b" : selectedZoneFilter;
  const activeSeries = telemetry?.series?.profiles?.[activeZoneKey] || {
    historical: [450, 490, 580, 720, 850, 820, 780],
    forecast: [880, 960, 1040, 980, 850, 710]
  };
  const activeLabels = telemetry?.series?.labels || [
    "12 AM", "2 AM", "4 AM", "6 AM", "8 AM", "10 AM", "12 PM",
    "2 PM", "4 PM", "6 PM", "8 PM", "10 PM", "12 AM"
  ];
  const forecastStartIndex = telemetry?.series?.forecastStartIndex ?? 6;

  const handleRoleTabChange = (role: "operator" | "analyst") => {
    setSelectedLoginRole(role);
    setLoginEmail(ROLE_PRESETS[role].email);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const preset = ROLE_PRESETS[selectedLoginRole];
    setCurrentUser({
      ...preset,
      lastLogin: new Date().toLocaleDateString("en-GB") + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " IST",
    });
    setIsLoginModalOpen(false);
  };

  const exportCsv = () => {
    let csv = "Zone,Initial Supply (L),Predicted Demand (L),Net Transfer (L),Recommended Allocation (L),Remaining Shortage (L)\n";
    redistributionPlan.forEach((z) => {
      csv += `"${z.name}",${z.availableSupply},${z.predictedDemand},${z.netTransfer},${z.recommendedAllocation},${z.remainingShortage}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jalsetu_water_redistribution_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Top Navbar */}
      <header className="navbar" role="banner">
        <div className="container nav-container">
          <div className="brand" onClick={() => setActiveView("home")} style={{ cursor: "pointer" }}>
            <span className="brand-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
              </svg>
            </span>
            <span>Smart Water Redistribution</span>
          </div>

          <nav aria-label="Main Navigation">
            <ul className="nav-links">
              <li>
                <button
                  className={`nav-link ${activeView === "home" ? "active" : ""}`}
                  onClick={() => setActiveView("home")}
                  style={{ background: "none", border: "none" }}
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  className={`nav-link ${activeView === "prediction" ? "active" : ""}`}
                  onClick={() => setActiveView("prediction")}
                  style={{ background: "none", border: "none" }}
                >
                  Prediction
                </button>
              </li>
              <li className="nav-dropdown">
                <span className={`nav-link ${["anomalies", "shortages", "redistribution"].includes(activeView) ? "active" : ""}`}>
                  Analysis ▾
                </span>
                <ul className="nav-dropdown-menu">
                  <li className="nav-dropdown-item">
                    <a href="#anomalies" onClick={(e) => { e.preventDefault(); setActiveView("anomalies"); }}>Abnormal Consumption</a>
                  </li>
                  <li className="nav-dropdown-item">
                    <a href="#shortages" onClick={(e) => { e.preventDefault(); setActiveView("shortages"); }}>Shortage Prediction</a>
                  </li>
                  <li className="nav-dropdown-item">
                    <a href="#redistribution" onClick={(e) => { e.preventDefault(); setActiveView("redistribution"); }}>Redistribution Plan</a>
                  </li>
                </ul>
              </li>
              <li>
                <button
                  className={`nav-link ${activeView === "map" ? "active" : ""}`}
                  onClick={() => setActiveView("map")}
                  style={{ background: "none", border: "none" }}
                >
                  Map
                </button>
              </li>
              <li>
                <button
                  className={`nav-link ${activeView === "about" ? "active" : ""}`}
                  onClick={() => setActiveView("about")}
                  style={{ background: "none", border: "none" }}
                >
                  About
                </button>
              </li>
            </ul>
          </nav>

          <div className="nav-right-actions">
            <button
              id="nav-user-btn"
              className="user-badge"
              title="Click to view Profile / Switch Account"
              aria-label="Current User Profile"
              style={{ border: "none", cursor: "pointer" }}
              onClick={() => setActiveView("profile")}
            >
              <span style={{ fontWeight: 700 }}>{currentUser.avatarInitials}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Views Container */}
      <main id="main-content" className="main-content" role="main">
        <div className="container">

          {/* VIEW 1: HOME / DASHBOARD */}
          {activeView === "home" && (
            <section className="page-view active" aria-labelledby="home-hero-title">
              <div className="hero-card">
                <div className="hero-left">
                  <h1 id="home-hero-title" className="hero-title">Smarter Water<br />for a Better Tomorrow</h1>
                  <p className="hero-subtitle">Predicting demand. Detecting shortages.<br />Recommending better distribution.</p>
                  
                  <div className="hero-controls">
                    <div className="form-group" style={{ minWidth: "180px" }}>
                      <label htmlFor="city-selector" className="form-label">Select City</label>
                      <select
                        id="city-selector"
                        className="form-select"
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                      >
                        <option value="Thane">Thane</option>
                        <option value="Pune">Pune</option>
                        <option value="Navi Mumbai">Navi Mumbai</option>
                      </select>
                    </div>
                    <button className="btn btn-primary" onClick={() => setActiveView("prediction")}>Get Started</button>
                  </div>
                </div>

                <div className="hero-visual" style={{ background: "transparent", border: "none", width: "380px", height: "230px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img
                    src="/assets/smart_city_hero.png"
                    alt="Smart City Water Network"
                    style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(1, 42, 92, 0.08))" }}
                  />
                </div>
              </div>

              {/* 4 Animated KPI Cards with brief load counting */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-icon-box blue" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Total Demand (Today)</span>
                    <span className="kpi-value">
                      <AnimatedKpiValue value={totalDemand} />
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box green" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12h10M12 7v10"/></svg>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Available Supply</span>
                    <span className="kpi-value positive">
                      <AnimatedKpiValue value={totalCurrentSupply} />
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box red" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Estimated Shortage</span>
                    <span className="kpi-value negative">
                      <AnimatedKpiValue value={totalShortage} />
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box teal" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Zones Monitored</span>
                    <span className="kpi-value">{zones.length}</span>
                  </div>
                </div>
              </div>

              {/* Quick Access */}
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-3)" }}>Quick Access</h2>
              <div className="quick-access-grid">
                <div className="quick-card" onClick={() => setActiveView("prediction")}>
                  <div className="quick-card-icon" style={{ background: "#E8F3FE", color: "#0867C4" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 3v18h18"/><path d="M18 9l-5 5-4-4-6 6"/></svg>
                  </div>
                  <h3 className="quick-card-title">Demand Prediction</h3>
                  <p className="quick-card-desc">View forecasted water usage for each zone</p>
                </div>

                <div className="quick-card" onClick={() => setActiveView("anomalies")}>
                  <div className="quick-card-icon" style={{ background: "#FDC8C8", color: "#C62828" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                  </div>
                  <h3 className="quick-card-title">Check for Anomalies</h3>
                  <p className="quick-card-desc">Find unusual consumption patterns & surges</p>
                </div>

                <div className="quick-card" onClick={() => setActiveView("shortages")}>
                  <div className="quick-card-icon" style={{ background: "#E8F3FE", color: "#0867C4" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                  </div>
                  <h3 className="quick-card-title">View Shortages</h3>
                  <p className="quick-card-desc">See which zones may face water shortage</p>
                </div>

                <div className="quick-card" onClick={() => setActiveView("redistribution")}>
                  <div className="quick-card-icon" style={{ background: "#D5F6D8", color: "#14632F" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
                  </div>
                  <h3 className="quick-card-title">Redistribution Plan</h3>
                  <p className="quick-card-desc">Get water allocation recommendations</p>
                </div>
              </div>

              {/* Priority Zones Overview Table */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Operational Zone Status Overview</h2>
                    <p className="card-subtitle">Real-time demand vs available supply for Thane District</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveView("redistribution")}>Reallocate Supply</button>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Zone Name</th>
                        <th className="text-right">Predicted Demand</th>
                        <th className="text-right">Available Supply</th>
                        <th className="text-right">Shortage</th>
                        <th className="text-center">Shortage Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zones.map((zone) => {
                        const shortage = JalsetuMath.calculateShortage(zone.predictedDemand, zone.availableSupply);
                        const risk = JalsetuMath.classifyRisk(zone.predictedDemand, zone.availableSupply);
                        const pillClass = risk === "High" ? "danger" : risk === "Medium" ? "warning" : "success";
                        return (
                          <tr key={zone.id}>
                            <td><strong>{zone.name}</strong> <span style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>({zone.displayName.split("(")[1] || ""}</span></td>
                            <td className="text-right">{JalsetuMath.formatNumber(zone.predictedDemand)} L</td>
                            <td className="text-right">{JalsetuMath.formatNumber(zone.availableSupply)} L</td>
                            <td className={`text-right`} style={shortage > 0 ? { color: "var(--color-value-negative)", fontWeight: 600 } : {}}>
                              {JalsetuMath.formatNumber(shortage)} L
                            </td>
                            <td className="text-center">
                              <span className={`status-pill ${pillClass}`}>{risk} Risk</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 2: DEMAND PREDICTION WITH HISTORICAL SOLID & PREDICTED DASHED */}
          {activeView === "prediction" && (
            <section className="page-view active" aria-labelledby="pred-page-title">
              <div className="card">
                <h1 id="pred-page-title" className="card-title" style={{ fontSize: "22px", marginBottom: "4px" }}>Demand Prediction</h1>
                <p className="card-subtitle" style={{ marginBottom: "var(--space-5)" }}>
                  AI model predicts future water consumption for each zone based on historical telemetry and weather covariates.
                </p>

                <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-end", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
                  <div className="form-group" style={{ minWidth: "180px" }}>
                    <label className="form-label">Select Date / Horizon</label>
                    <select
                      className="form-select"
                      value={selectedHorizon}
                      onChange={(e) => setSelectedHorizon(e.target.value)}
                    >
                      <option value="24h">Next 24 Hours</option>
                      <option value="48h">Next 48 Hours</option>
                      <option value="7d">Next 7 Days</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ minWidth: "180px" }}>
                    <label className="form-label">Select Zone</label>
                    <select
                      className="form-select"
                      value={selectedZoneFilter}
                      onChange={(e) => setSelectedZoneFilter(e.target.value)}
                    >
                      <option value="all">Zone B (Central Commercial — Primary Alert)</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>{z.name} ({z.displayName})</option>
                      ))}
                    </select>
                  </div>

                  <button className="btn btn-primary" onClick={() => alert("Model inference refreshed with latest meter readings.")}>Predict</button>
                </div>

                {/* Animated Chart: Solid Blue Historical, Dashed Blue Forecast, Vertical Line Indicator */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700 }}>
                    Water Demand Profile ({zones.find(z => z.id === activeZoneKey)?.name || "Zone B"})
                  </h2>
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "16px", height: "3px", background: "#1F6FDB" }}></span> Solid: Historical Actual
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "16px", height: "3px", borderTop: "2px dashed #0867C4" }}></span> Dashed: Model Predicted
                    </span>
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "var(--space-6)" }}>
                  <ForecastSplitChart
                    labels={activeLabels}
                    forecastStartIndex={forecastStartIndex}
                    historicalData={activeSeries.historical}
                    forecastData={activeSeries.forecast}
                    zoneName={zones.find(z => z.id === activeZoneKey)?.name || "Zone B"}
                  />
                </div>

                {/* Table */}
                <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "var(--space-3)" }}>Predicted Demand (Next 24 Hours)</h2>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Zone</th>
                        <th className="text-right">Predicted Demand (kL)</th>
                        <th className="text-center">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zones.map((zone) => {
                        const trendIcon = zone.trend === "Increase" ? "↑" : zone.trend === "Decrease" ? "↓" : "—";
                        return (
                          <tr key={zone.id}>
                            <td><strong>{zone.name}</strong></td>
                            <td className="text-right">{JalsetuMath.formatNumber(zone.predictedDemand / 1000)}</td>
                            <td className="text-center">
                              <span className={`trend-indicator ${zone.trend.toLowerCase()}`}>
                                {trendIcon} {zone.trend}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 3: ABNORMAL CONSUMPTION DETECTION */}
          {activeView === "anomalies" && (
            <section className="page-view active" aria-labelledby="anomaly-page-title">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h1 id="anomaly-page-title" className="card-title" style={{ fontSize: "22px", marginBottom: "4px" }}>Abnormal Consumption Detection</h1>
                    <p className="card-subtitle">
                      Residual-based robust anomaly scoring (MAD z-score) isolates continuous leaks from sudden pipe surges.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Filter Severity:</label>
                    <select
                      className="form-select"
                      style={{ height: "34px", padding: "0 8px", fontSize: "13px" }}
                      value={anomalySeverityFilter}
                      onChange={(e) => setAnomalySeverityFilter(e.target.value)}
                    >
                      <option value="all">All Severities</option>
                      <option value="High Alert">High Alert (Surges)</option>
                      <option value="High">High (Elevations)</option>
                      <option value="Normal">Normal</option>
                    </select>
                  </div>
                </div>

                <div className="table-responsive" style={{ marginBottom: "var(--space-6)" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Zone</th>
                        <th>Classification</th>
                        <th className="text-right">Current Consumption (L)</th>
                        <th className="text-right">Normal Range (L)</th>
                        <th className="text-right">Deviation</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zones
                        .filter((z) => anomalySeverityFilter === "all" || z.anomaly.severity === anomalySeverityFilter)
                        .map((zone) => {
                          const isAlert = zone.anomaly.severity === "High Alert";
                          const isHigh = zone.anomaly.severity === "High";
                          const pillClass = isAlert ? "danger" : isHigh ? "warning" : "success";
                          return (
                            <tr key={zone.id}>
                              <td><strong>{zone.name}</strong> <span style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>({zone.displayName})</span></td>
                              <td>{zone.anomaly.type}</td>
                              <td className="text-right"><strong>{zone.currentConsumption}</strong> L</td>
                              <td className="text-right" style={{ color: "var(--color-text-secondary)" }}>{zone.normalRange[0]} – {zone.normalRange[1]} L</td>
                              <td className="text-right" style={zone.anomaly.deviationPct > 0 ? { color: "var(--color-value-negative)", fontWeight: 600 } : {}}>
                                {zone.anomaly.deviationPct > 0 ? `+${zone.anomaly.deviationPct}%` : `${zone.anomaly.deviationPct}%`}
                              </td>
                              <td className="text-center">
                                <span className={`status-pill ${pillClass}`}>{zone.anomaly.severity}</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="alert-banner" role="alert">
                  <div className="alert-banner-left">
                    <span className="alert-icon" aria-hidden="true">⚠️</span>
                    <div>
                      <div className="alert-title">Critical Pipe Surge Identified: Zone B</div>
                      <div className="alert-subtitle">Current consumption (850 L) is +42% above normal threshold. Residual z-score: 4.8.</div>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => { setSelectedZoneFilter("zone-b"); setActiveView("prediction"); }}>
                    Inspect Forecast Profile
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 4: SHORTAGE PREDICTION */}
          {activeView === "shortages" && (
            <section className="page-view active" aria-labelledby="shortage-page-title">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h1 id="shortage-page-title" className="card-title" style={{ fontSize: "22px", marginBottom: "4px" }}>Shortage Prediction</h1>
                    <p className="card-subtitle">
                      Calculates deficit per zone: <code>shortage = max(0, predicted_demand - available_supply)</code>.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <select
                      className="form-select"
                      style={{ height: "34px", padding: "0 8px", fontSize: "13px" }}
                      value={shortageRiskFilter}
                      onChange={(e) => setShortageRiskFilter(e.target.value)}
                    >
                      <option value="all">All Risk Levels</option>
                      <option value="High">High Risk (Deficit ≥ 20%)</option>
                      <option value="Medium">Medium Risk (Deficit ≥ 5%)</option>
                      <option value="Low">Low Risk / Adequate</option>
                    </select>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShortageSortAsc(!shortageSortAsc)}
                    >
                      Sort by Deficit {shortageSortAsc ? "↑" : "↓"}
                    </button>
                  </div>
                </div>

                <div className="table-responsive" style={{ marginBottom: "var(--space-6)" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Zone</th>
                        <th className="text-right">Predicted Demand (L)</th>
                        <th className="text-right">Available Supply (L)</th>
                        <th className="text-right">Shortage (L)</th>
                        <th className="text-right">Deficit Ratio</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zones
                        .filter((zone) => {
                          if (shortageRiskFilter === "all") return true;
                          const risk = JalsetuMath.classifyRisk(zone.predictedDemand, zone.availableSupply);
                          return risk === shortageRiskFilter;
                        })
                        .sort((a, b) => {
                          const shortA = JalsetuMath.calculateShortage(a.predictedDemand, a.availableSupply);
                          const shortB = JalsetuMath.calculateShortage(b.predictedDemand, b.availableSupply);
                          return shortageSortAsc ? shortA - shortB : shortB - shortA;
                        })
                        .map((zone) => {
                          const shortage = JalsetuMath.calculateShortage(zone.predictedDemand, zone.availableSupply);
                          const pct = (shortage / zone.predictedDemand) * 100;
                          const isSlight = shortage > 0 && pct < 10;
                          const pillClass = isSlight ? "slight" : shortage > 0 ? "shortage" : "adequate";
                          const pillText = isSlight ? "Slight" : shortage > 0 ? "Shortage" : "Adequate";
                          return (
                            <tr key={zone.id}>
                              <td><strong>{zone.name}</strong> <span style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>({zone.displayName})</span></td>
                              <td className="text-right">{JalsetuMath.formatNumber(zone.predictedDemand)}</td>
                              <td className="text-right">{JalsetuMath.formatNumber(zone.availableSupply)}</td>
                              <td className="text-right" style={shortage > 0 ? { color: "var(--color-value-negative)", fontWeight: 700 } : {}}>
                                {shortage > 0 ? JalsetuMath.formatNumber(shortage) : "0"}
                              </td>
                              <td className="text-right" style={{ color: "var(--color-text-secondary)" }}>
                                {pct > 0 ? `${pct.toFixed(1)}%` : "0%"}
                              </td>
                              <td className="text-center">
                                <span className={`status-pill ${pillClass}`}>{pillText}</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="info-note-banner">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <div>
                    <strong>Total Estimated Municipal Shortage: {JalsetuMath.formatNumber(totalShortage)} L</strong>
                    <div style={{ fontSize: "12px", opacity: 0.9 }}>
                      (Deficit calculation: 2 zones in shortage, 1 zone with surplus capacity ready for reallocation)
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 5: REDISTRIBUTION PLAN */}
          {activeView === "redistribution" && (
            <section className="page-view active" aria-labelledby="redist-page-title">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h1 id="redist-page-title" className="card-title" style={{ fontSize: "22px", marginBottom: "4px" }}>Recommended Water Redistribution</h1>
                    <p className="card-subtitle">Based on predicted demand, current supply and shortage risk.</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={exportCsv}>Export Plan (CSV)</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
                  <div style={{ background: "#E8F3FE", border: "1px solid #C8E1FA", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
                    <div style={{ fontSize: "13px", color: "#0553A0", fontWeight: 600, marginBottom: "4px" }}>💧 Available for Redistribution</div>
                    <div style={{ fontSize: "26px", fontWeight: 700, color: "#0867C4" }}>150,000 L</div>
                  </div>

                  <div style={{ background: "#FDF4F7", border: "1px solid #F9CFDC", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
                    <div style={{ fontSize: "13px", color: "#9B1C2C", fontWeight: 600, marginBottom: "4px" }}>🚨 Priority Zones</div>
                    <div style={{ fontSize: "13px", color: "var(--color-text-primary)", lineHeight: 1.4 }}>
                      <div>1. <strong>Zone B</strong> (Highest risk)</div>
                      <div>2. <strong>Zone C</strong> (Medium risk)</div>
                      <div>3. <strong>Zone D</strong> (Low risk)</div>
                    </div>
                  </div>
                </div>

                {/* Interactive Slider */}
                <div className="slider-control-box">
                  <div className="slider-header">
                    <label htmlFor="redist-slider" style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      What-If Scenario: Adjust Total Available City Supply ({JalsetuMath.formatNumber(totalAvailableSupply)} L)
                    </label>
                    <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>(Live recalculation)</span>
                  </div>
                  <input
                    type="range"
                    id="redist-slider"
                    className="range-slider"
                    min="1000000"
                    max="3000000"
                    step="50000"
                    value={totalAvailableSupply}
                    onChange={(e) => setTotalAvailableSupply(parseInt(e.target.value, 10))}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                    <span>Deficit (1,000,000 L)</span>
                    <span>Baseline (1,620,000 L)</span>
                    <span>Surplus (3,000,000 L)</span>
                  </div>
                </div>

                {/* Table */}
                <div className="table-responsive" style={{ marginBottom: "var(--space-4)" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Zone</th>
                        <th className="text-right">Current Supply (L)</th>
                        <th className="text-right">Recommended Allocation (L)</th>
                        <th className="text-right">New Supply (L)</th>
                        <th className="text-right">Remaining Shortage (L)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redistributionPlan.map((zone) => {
                        const transferSign = zone.netTransfer > 0 ? `+${JalsetuMath.formatNumber(zone.netTransfer)}` : (zone.netTransfer < 0 ? JalsetuMath.formatNumber(zone.netTransfer) : "+0");
                        const transferStyle = zone.netTransfer > 0 ? { color: "var(--color-value-positive)", fontWeight: 600 } : (zone.netTransfer < 0 ? { color: "var(--color-value-negative)" } : { color: "var(--color-text-secondary)" });
                        return (
                          <tr key={zone.id}>
                            <td><strong>{zone.name}</strong></td>
                            <td className="text-right">{JalsetuMath.formatNumber(zone.availableSupply)}</td>
                            <td className="text-right" style={transferStyle}>{transferSign}</td>
                            <td className="text-right"><strong>{JalsetuMath.formatNumber(zone.recommendedAllocation)}</strong></td>
                            <td className="text-right" style={zone.remainingShortage > 0 ? { color: "var(--color-value-negative)", fontWeight: 600 } : {}}>
                              {zone.remainingShortage > 0 ? JalsetuMath.formatNumber(zone.remainingShortage) : "0"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="info-note-banner teal">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <div>
                    <strong>Note:</strong> Redistribution is subject to pipeline capacity and infrastructure constraints.
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 6: MAP VIEW & REDISTRIBUTION SIMULATION */}
          {activeView === "map" && (
            <section className="page-view active" aria-labelledby="map-page-title">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h1 id="map-page-title" className="card-title" style={{ fontSize: "22px", marginBottom: "4px" }}>City Water Risk & Infrastructure Map</h1>
                    <p className="card-subtitle">Interactive Leaflet GIS with real-time zone metrics and simulated pipe redistribution routes.</p>
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      className={`btn ${simulationActive ? "btn-secondary" : "btn-primary"}`}
                      onClick={() => setSimulationActive(!simulationActive)}
                    >
                      {simulationActive ? "Hide Transfer Routes" : "⚡ Simulate Redistribution Routes"}
                    </button>
                    <div style={{ display: "flex", gap: "10px", fontSize: "12px", alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#D9363E" }}></span> High Risk</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#FFA94D" }}></span> Medium Risk</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2B8A3E" }}></span> Low Risk</span>
                    </div>
                  </div>
                </div>

                <div className="map-view-grid">
                  <div style={{ height: "420px", position: "relative" }}>
                    <InteractiveRiskMap
                      zones={zones}
                      selectedZoneId={selectedMapZone?.id}
                      onSelectZone={(z) => setSelectedMapZone(z)}
                      simulationActive={simulationActive}
                      transferRoutes={telemetry?.transferRoutes || []}
                    />
                  </div>

                  {/* Zone Inspection Panel */}
                  <div style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "var(--space-2)", color: "var(--color-text-primary)" }}>
                        {selectedMapZone ? `${selectedMapZone.name} Overview` : "Select a Zone"}
                      </h2>
                      {selectedMapZone && (
                        <div style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--color-text-primary)" }}>
                          <div style={{ color: "var(--color-text-secondary)", fontSize: "12px", marginBottom: "6px" }}>{selectedMapZone.displayName}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--color-border)" }}>
                            <span>Demand:</span> <strong>{JalsetuMath.formatNumber(selectedMapZone.predictedDemand)} L</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--color-border)" }}>
                            <span>Supply:</span> <strong>{JalsetuMath.formatNumber(selectedMapZone.availableSupply)} L</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--color-border)" }}>
                            <span>Shortage:</span> <strong style={{ color: "var(--color-value-negative)" }}>{JalsetuMath.formatNumber(JalsetuMath.calculateShortage(selectedMapZone.predictedDemand, selectedMapZone.availableSupply))} L</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                            <span>Risk Status:</span> <strong style={{ color: JalsetuMath.classifyRisk(selectedMapZone.predictedDemand, selectedMapZone.availableSupply) === "High" ? "#D9363E" : "#2B8A3E" }}>{JalsetuMath.classifyRisk(selectedMapZone.predictedDemand, selectedMapZone.availableSupply)} Risk</strong>
                          </div>
                        </div>
                      )}

                      <hr style={{ border: 0, borderTop: "1px solid var(--color-border)", margin: "12px 0" }} />

                      <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "var(--space-2)", color: "var(--color-text-primary)" }}>Key Spatial Insights</h3>
                      <div className="insight-item">
                        <span className="insight-icon">⚠️</span>
                        <div><strong>Zone B</strong> has the highest shortage risk (34% deficit).</div>
                      </div>
                      <div className="insight-item">
                        <span className="insight-icon">💧</span>
                        <div><strong>Zone A</strong> has surplus supply (100,000 L).</div>
                      </div>
                      <div className="insight-item">
                        <span className="insight-icon">🔄</span>
                        <div>Optimal transfer: <strong>A → B (100,000 L)</strong></div>
                      </div>
                    </div>

                    {simulationActive && (
                      <div style={{ background: "#E8F3FE", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid #C8E1FA", fontSize: "12px", color: "#0867C4", marginTop: "12px" }}>
                        ✓ <strong>Simulation Active:</strong> 2 redistribution pipelines routed on map.
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Trend & Weather Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-6)", marginTop: "var(--space-4)" }}>
                  <div>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "var(--space-3)" }}>
                      Water Consumption Trend ({selectedMapZone?.name || "Zone B"})
                    </h2>
                    <div style={{ background: "#FFFFFF", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "16px" }}>
                      <ForecastSplitChart
                        labels={activeLabels}
                        forecastStartIndex={forecastStartIndex}
                        historicalData={activeSeries.historical}
                        forecastData={activeSeries.forecast}
                        zoneName={selectedMapZone?.name || "Zone B"}
                      />
                    </div>
                  </div>

                  <div>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "var(--space-3)" }}>Weather Covariates</h2>
                    <div className="weather-box">
                      <div>
                        <div className="weather-temp">32°C</div>
                        <div className="weather-desc">Mostly Sunny</div>
                      </div>
                      <div style={{ fontSize: "36px" }} aria-hidden="true">☀️</div>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "8px" }}>
                      Higher demand predicted in next 24 hours (+8.4% above seasonal median) driven by heat index elevation.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 7: ABOUT */}
          {activeView === "about" && (
            <section className="page-view active" aria-labelledby="about-page-title">
              <div className="card">
                <h1 id="about-page-title" className="card-title" style={{ fontSize: "22px", marginBottom: "4px" }}>About Jalsetu (WDMS)</h1>
                <p className="card-subtitle" style={{ marginBottom: "var(--space-5)" }}>
                  Intelligent Water Demand Management System for Municipal Operations
                </p>

                <div style={{ lineHeight: 1.6, color: "var(--color-text-primary)" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, marginTop: "16px", marginBottom: "8px" }}>1. Purpose & Core Objective</h2>
                  <p>
                    Jalsetu bridges historical water consumption patterns and forward-looking operational decisions. Built specifically for water operations officers and municipal planners, it transforms raw sensor telemetry and meter datasets into actionable redistributions.
                  </p>

                  <h2 style={{ fontSize: "16px", fontWeight: 700, marginTop: "20px", marginBottom: "8px" }}>2. Core Methodology & Algorithms</h2>
                  <ul style={{ paddingLeft: "20px", marginBottom: "16px" }}>
                    <li><strong>Demand Forecasting:</strong> LightGBM global regressor using lag profiles (1h, 24h, 168h), cyclical time features, and weather covariates to beat seasonal-naive baselines.</li>
                    <li><strong>Anomaly Scoring:</strong> Residual-based robust z-score scoring using Median Absolute Deviation (MAD) with dedicated surge thresholding for rapid pipe bursts or unauthorized draws.</li>
                    <li><strong>Shortage Estimation:</strong> Formulated as <code>shortage = max(0, predicted_demand - available_supply)</code>, categorizing zones into Low, Medium, and High risk.</li>
                    <li><strong>Supply Redistribution:</strong> Weighted progressive water-filling that respects capacity constraints, caps each zone at its expected demand, and prioritizes critical risk regions.</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 8: OPERATOR PROFILE */}
          {activeView === "profile" && (
            <section className="page-view active" aria-labelledby="profile-page-title">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h1 id="profile-page-title" className="card-title" style={{ fontSize: "22px", marginBottom: "4px" }}>Operator Profile & Credentials</h1>
                    <p className="card-subtitle">Manage municipal jurisdiction, operational role and system authorizations.</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setIsLoginModalOpen(true)}>Switch User / Login</button>
                </div>

                <div className="profile-grid">
                  <div style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-6)", textAlign: "center" }}>
                    <div className="profile-avatar-box">{currentUser.avatarInitials}</div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "2px" }}>{currentUser.name}</h2>
                    <div style={{ fontSize: "13px", color: "var(--color-primary)", fontWeight: 600, marginBottom: "var(--space-4)" }}>{currentUser.role}</div>
                    
                    <div style={{ textAlign: "left", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
                      <div className="profile-meta-item">
                        <span className="profile-meta-label">Employee ID</span>
                        <span className="profile-meta-val">{currentUser.id}</span>
                      </div>
                      <div className="profile-meta-item">
                        <span className="profile-meta-label">Email</span>
                        <span className="profile-meta-val" style={{ fontSize: "12px" }}>{currentUser.email}</span>
                      </div>
                      <div className="profile-meta-item">
                        <span className="profile-meta-label">Status</span>
                        <span className="status-pill success">Active Duty</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "var(--space-4)" }}>Administrative Responsibilities</h2>
                    <div style={{ background: "#FFFFFF", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-5)", marginBottom: "var(--space-5)" }}>
                      <div className="profile-meta-item">
                        <span className="profile-meta-label">Department</span>
                        <span className="profile-meta-val">{currentUser.department}</span>
                      </div>
                      <div className="profile-meta-item">
                        <span className="profile-meta-label">Assigned Jurisdiction</span>
                        <span className="profile-meta-val">{currentUser.jurisdiction}</span>
                      </div>
                      <div className="profile-meta-item">
                        <span className="profile-meta-label">Authorization Clearance</span>
                        <span className="profile-meta-val" style={{ color: "var(--color-primary)" }}>{currentUser.accessLevel}</span>
                      </div>
                      <div className="profile-meta-item">
                        <span className="profile-meta-label">Session Authenticated</span>
                        <span className="profile-meta-val">{currentUser.lastLogin}</span>
                      </div>
                    </div>

                    <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "var(--space-3)" }}>Operational Permissions</h2>
                    <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
                      <li>✔️ <strong>Demand Redistribution Execution:</strong> Authorized to execute inter-zone pipeline allocations.</li>
                      <li>✔️ <strong>Surge & Leakage Incident Override:</strong> Authorized to acknowledge critical anomaly alarms.</li>
                      <li>✔️ <strong>What-If Scenario Simulation:</strong> Authorized to adjust municipal emergency supply baselines.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

        </div>
      </main>

      {/* LOGIN MODAL */}
      {isLoginModalOpen && (
        <div className="modal-overlay active" role="dialog" aria-modal="true" onClick={() => setIsLoginModalOpen(false)}>
          <div className="auth-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsLoginModalOpen(false)} aria-label="Close">✕</button>

            <div className="auth-header">
              <div className="auth-logo-badge" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                </svg>
              </div>
              <h2 className="auth-title">Jalsetu Sign In</h2>
              <p className="auth-subtitle">Municipal Smart City Water Management Portal</p>
            </div>

            <div className="role-switcher-grid">
              <button
                type="button"
                className={`role-tab-btn ${selectedLoginRole === "operator" ? "active" : ""}`}
                onClick={() => handleRoleTabChange("operator")}
              >
                Operations Officer
              </button>
              <button
                type="button"
                className={`role-tab-btn ${selectedLoginRole === "analyst" ? "active" : ""}`}
                onClick={() => handleRoleTabChange("analyst")}
              >
                Water Analyst
              </button>
            </div>

            <form onSubmit={handleLoginSubmit}>
              <div className="form-group" style={{ marginBottom: "var(--space-4)" }}>
                <label className="form-label">Official Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: "var(--space-5)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="form-label">Password / Security PIN</label>
                  <span style={{ fontSize: "12px", color: "var(--color-primary)", cursor: "pointer" }} onClick={() => alert("Demo credentials pre-filled.")}>Forgot PIN?</span>
                </div>
                <input type="password" className="form-input" defaultValue="••••••••••••" required />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", height: "42px" }}>
                Authenticate & Access Dashboard
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="footer" role="contentinfo">
        <div className="container footer-inner">
          <div>
            <strong>Jalsetu</strong> — Water Demand Management System &bull; Municipal Operations Dashboard
          </div>
          <div>
            Next.js App Router &bull; Smart City Hackathon 2026
          </div>
        </div>
      </footer>
    </>
  );
}
