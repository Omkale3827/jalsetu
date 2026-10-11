"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { INITIAL_ZONES, INITIAL_USER, ROLE_PRESETS, INITIAL_REPORTS, Zone, UserProfile, CitizenReport } from "@/lib/data";
import { JalsetuMath } from "@/lib/math";
import AnimatedKpiValue from "@/components/AnimatedKpiValue";
import ForecastSplitChart from "@/components/ForecastSplitChart";
import ReportWastageView from "@/components/ReportWastageView";

// Dynamically import Leaflet components with SSR disabled
const InteractiveRiskMap = dynamic(() => import("@/components/InteractiveRiskMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "420px", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F9", border: "1px solid var(--cmd-border)", borderRadius: "var(--radius-md)" }}>
      <span style={{ color: "var(--cmd-hydro-blue)", fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: "13px" }}>
        INITIALIZING GIS SPATIAL NETWORK LAYERS...
      </span>
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

  // Citizen Wastage Reporting States
  const [reports, setReports] = useState<CitizenReport[]>(INITIAL_REPORTS);
  const [reportInitialTab, setReportInitialTab] = useState<"submit" | "track" | "mcd">("submit");

  const handleAddReport = (newReport: CitizenReport) => {
    setReports((prev) => [newReport, ...prev]);
  };

  const handleUpdateReportStatus = (id: string, newStatus: CitizenReport["status"]) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
  };

  // Fetch telemetry from backend API route
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

  // Aggregate Metrics
  const totalDemand = zones.reduce((s, z) => s + z.predictedDemand, 0);
  const totalCurrentSupply = zones.reduce((s, z) => s + z.availableSupply, 0);
  const totalShortage = zones.reduce((s, z) => s + JalsetuMath.calculateShortage(z.predictedDemand, z.availableSupply), 0);
  const criticalZonesCount = zones.filter((z) => JalsetuMath.classifyRisk(z.predictedDemand, z.availableSupply) === "High").length;
  const deficitPercentage = totalDemand > 0 ? ((totalShortage / totalDemand) * 100).toFixed(1) : "0.0";

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

  // Handle Role Switching
  const handleRoleSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    const preset = ROLE_PRESETS[selectedLoginRole];
    setCurrentUser({
      ...preset,
      email: loginEmail,
      lastLogin: `2026-10-11 ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST`
    });
    setIsLoginModalOpen(false);
  };

  const navItems = [
    { id: "home", label: "Overview", idx: "01" },
    { id: "prediction", label: "Demand Prediction", idx: "02" },
    { id: "anomalies", label: "Anomaly Forensics", idx: "03" },
    { id: "shortages", label: "Shortage Matrix", idx: "04" },
    { id: "redistribution", label: "Redistribution Plan", idx: "05" },
    { id: "map", label: "GIS Network Map", idx: "06" },
    { id: "report", label: "Citizen Leak Desk", idx: "07" },
    { id: "about", label: "Operations Manual", idx: "08" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <a href="#main-content" className="skip-link">Skip to Municipal Operations Content</a>

      {/* TOP COMMAND MASTHEAD */}
      <header className="command-masthead" role="banner">
        {/* Real-time Telemetry Status Ticker */}
        <div className="telemetry-ticker">
          <div className="cmd-container ticker-inner">
            <div className="ticker-group">
              <div className="ticker-item">
                <span className="pulse-dot"></span>
                <span>SYSTEM: SCADA TELEMETRY ONLINE</span>
              </div>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
              <div className="ticker-item">
                <span>SECTOR: {selectedCity.toUpperCase()} METROPOLITAN (DIV-04)</span>
              </div>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
              <div className="ticker-item">
                <span>DEFICIT INDEX: <strong style={{ color: "#FCA5A5" }}>{deficitPercentage}%</strong></span>
              </div>
            </div>

            <div className="ticker-group">
              <div className="ticker-item">
                <span className="pulse-dot danger"></span>
                <span>ACTIVE CITIZEN LEAK PINS: <strong style={{ color: "#FCA5A5" }}>{reports.length}</strong> (1 BURST IN ZONE B)</span>
              </div>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
              <div className="ticker-item">
                <span>2026-10-11 12:55 IST</span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Command Station Header */}
        <div className="cmd-container masthead-nav">
          <div className="brand-station" onClick={() => setActiveView("home")}>
            <div className="station-badge" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
              </svg>
            </div>
            <div className="station-title-box">
              <span className="station-name">
                JALSETU <span className="station-name-sub">जलसेतु · WDMS</span>
              </span>
              <span className="station-subtext">MUNICIPAL WATER DEMAND & REDISTRIBUTION COMMAND</span>
            </div>
          </div>

          {/* Tactical Nav Tabs */}
          <nav aria-label="Command Station Navigation">
            <ul className="tactical-nav-list">
              {navItems.map((item) => (
                <li key={item.id} className="tactical-nav-item">
                  <button
                    className={activeView === item.id ? "active" : ""}
                    onClick={() => {
                      setActiveView(item.id);
                      if (item.id === "report") setReportInitialTab("submit");
                    }}
                  >
                    <span className="nav-idx">{item.idx}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Operator Badge */}
          <div
            className="operator-crest"
            onClick={() => setIsLoginModalOpen(true)}
            title="Authorized Municipal Officer - Click to Switch User"
          >
            <div className="crest-avatar">{currentUser.avatarInitials}</div>
            <div className="crest-meta">
              <span className="crest-name">{currentUser.name.split(" ")[0]} ({currentUser.avatarInitials})</span>
              <span className="crest-role">{currentUser.role.split(" ")[0]} · TIER-1</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN OPERATIONAL SURFACE */}
      <main id="main-content" style={{ flex: 1, paddingBottom: "var(--space-8)" }} role="main">
        <div className="cmd-container">

          {/* VIEW 1: OVERVIEW & SITUATION ROOM */}
          {activeView === "home" && (
            <div>
              {/* Situation Room Console */}
              <div className="situation-console">
                <div className="console-header-strip">
                  <span>OPERATIONAL SITUATION ROOM · THANE CENTRAL DISTRICT</span>
                  <span>TIME HORIZON: {selectedHorizon.toUpperCase()} · ALGORITHM: LIGHTGBM + MAD FORENSICS</span>
                </div>

                <div className="console-split-body">
                  {/* Left: District Water Balance */}
                  <div className="balance-sector">
                    <div className="sector-headline">District Hydraulic Equilibrium</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--cmd-text-heading)" }}>
                        {JalsetuMath.formatNumber(totalCurrentSupply)} L <span style={{ fontSize: "12px", color: "var(--cmd-text-muted)" }}>Available</span>
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--cmd-critical-red)" }}>
                        Deficit: {JalsetuMath.formatNumber(totalShortage)} L ({deficitPercentage}%)
                      </span>
                    </div>

                    <div className="balance-gauge-track" title={`Supply: ${totalCurrentSupply} L, Deficit: ${totalShortage} L`}>
                      <div
                        className="gauge-fill-supply"
                        style={{ width: `${Math.min(100, (totalCurrentSupply / (totalDemand || 1)) * 100)}%` }}
                      />
                      <div
                        className="gauge-fill-deficit"
                        style={{ width: `${Math.min(100, (totalShortage / (totalDemand || 1)) * 100)}%` }}
                      />
                    </div>

                    <div className="balance-numbers-grid">
                      <div className="telemetry-cell">
                        <span className="cell-label">Predicted Demand</span>
                        <span className="cell-val">{JalsetuMath.formatNumber(totalDemand / 1000)}<span className="cell-unit">k L</span></span>
                      </div>
                      <div className="telemetry-cell">
                        <span className="cell-label">Allocated Buffer</span>
                        <span className="cell-val">{JalsetuMath.formatNumber(totalCurrentSupply / 1000)}<span className="cell-unit">k L</span></span>
                      </div>
                      <div className="telemetry-cell">
                        <span className="cell-label">Critical Sinks</span>
                        <span className="cell-val" style={{ color: "var(--cmd-critical-red)" }}>{criticalZonesCount}<span className="cell-unit">Zones</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Urgent Corroboration Alert Hub */}
                  <div className="corroboration-sector">
                    <div>
                      <div className="urgent-badge-row">
                        <span className="urgent-pill">
                          <span>⚡</span> SURGE EVENT DETECTED
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--cmd-critical-red)", fontWeight: 700 }}>
                          RESIDUAL Z-SCORE: +4.8σ
                        </span>
                      </div>

                      <div className="corroboration-body">
                        <h3>Critical Rupture Corroboration: Zone B (Central Commercial)</h3>
                        <p className="corroboration-text">
                          Consumption spiked to 850 L (+42% over MAD threshold). Live telemetry correlates with citizen photo report logged 35 minutes ago at Majiwada Junction.
                        </p>
                      </div>

                      <div className="corroboration-evidence-box">
                        <strong>Evidence Tag:</strong> Report <code>MCD-2026-88F4A1</code> · Category: <strong>Burst pipe</strong> · Severity: <strong>Heavy flow</strong> · Assigned Authority: <strong>MCD Field Board</strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <button
                        className="btn-cmd btn-cmd-danger btn-cmd-sm"
                        onClick={() => { setActiveView("anomalies"); }}
                      >
                        Investigate Surge Forensics
                      </button>
                      <button
                        className="btn-cmd btn-cmd-secondary btn-cmd-sm"
                        onClick={() => { setActiveView("redistribution"); }}
                      >
                        Dispatch Rebalance Flow
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Telemetry Ribbon Bar */}
              <div className="telemetry-ribbon-bar">
                <div className="ribbon-card">
                  <div className="ribbon-top">
                    <span className="ribbon-label">Total Projected Demand</span>
                    <span style={{ fontSize: "11px", color: "var(--cmd-text-muted)" }}>24h Horizon</span>
                  </div>
                  <div className="ribbon-figure">
                    <AnimatedKpiValue value={totalDemand} suffix=" L" />
                  </div>
                  <div className="ribbon-sub">Summed across {zones.length} monitored municipal wds</div>
                </div>

                <div className="ribbon-card green">
                  <div className="ribbon-top">
                    <span className="ribbon-label">Available Municipal Supply</span>
                    <span style={{ fontSize: "11px", color: "var(--cmd-adequate-green)" }}>+Buffer</span>
                  </div>
                  <div className="ribbon-figure">
                    <AnimatedKpiValue value={totalAvailableSupply} suffix=" L" />
                  </div>
                  <div className="ribbon-sub">Scenario baseline adjustable in What-If console</div>
                </div>

                <div className="ribbon-card red">
                  <div className="ribbon-top">
                    <span className="ribbon-label">Estimated Water Deficit</span>
                    <span style={{ fontSize: "11px", color: "var(--cmd-critical-red)" }}>Deficit Gap</span>
                  </div>
                  <div className="ribbon-figure" style={{ color: "var(--cmd-critical-red)" }}>
                    <AnimatedKpiValue value={totalShortage} suffix=" L" />
                  </div>
                  <div className="ribbon-sub">{deficitPercentage}% shortfall requires reallocation</div>
                </div>

                <div className="ribbon-card amber">
                  <div className="ribbon-top">
                    <span className="ribbon-label">Active Field Incidents</span>
                    <span style={{ fontSize: "11px", color: "var(--cmd-alert-amber)" }}>MCD Intake</span>
                  </div>
                  <div className="ribbon-figure" style={{ color: "var(--cmd-alert-amber)" }}>
                    {reports.length} <span style={{ fontSize: "14px", fontWeight: 500 }}>Pins</span>
                  </div>
                  <div className="ribbon-sub">1 Burst pipe (Zone B), 1 Secondary leak (Zone D)</div>
                </div>
              </div>

              {/* Quick Access Workflow Hub */}
              <div style={{ marginBottom: "var(--space-3)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, color: "var(--cmd-text-muted)" }}>
                  Operational Workflows & Functional Dispatch
                </span>
                <span style={{ fontSize: "11px", color: "var(--cmd-text-subtle)", fontFamily: "var(--font-mono)" }}>
                  5 CORE WORKFLOW MODULES
                </span>
              </div>

              <div className="workflow-hub-grid">
                <div className="workflow-card" onClick={() => setActiveView("prediction")}>
                  <div>
                    <div className="workflow-idx">02 // FORECAST</div>
                    <div className="workflow-title">Demand Prediction</div>
                    <div className="workflow-desc">Multi-zone LightGBM consumption profiles & peak hours</div>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--cmd-hydro-blue)", fontWeight: 600, marginTop: "8px" }}>Explore Curves →</span>
                </div>

                <div className="workflow-card" onClick={() => setActiveView("anomalies")}>
                  <div>
                    <div className="workflow-idx">03 // FORENSICS</div>
                    <div className="workflow-title">Surge & Anomaly Radar</div>
                    <div className="workflow-desc">Residual z-scores, pipe rupture flags & citizen cross-validation</div>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--cmd-critical-red)", fontWeight: 600, marginTop: "8px" }}>Review Flags →</span>
                </div>

                <div className="workflow-card" onClick={() => setActiveView("shortages")}>
                  <div>
                    <div className="workflow-idx">04 // SHORTAGE</div>
                    <div className="workflow-title">Shortage Assessment</div>
                    <div className="workflow-desc">Deficit formulas, risk tier ranking & vulnerable zones</div>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--cmd-alert-amber)", fontWeight: 600, marginTop: "8px" }}>Inspect Matrix →</span>
                </div>

                <div className="workflow-card" onClick={() => setActiveView("redistribution")}>
                  <div>
                    <div className="workflow-idx">05 // BALANCING</div>
                    <div className="workflow-title">Water-Filling Rebalancing</div>
                    <div className="workflow-desc">Supply slider, transfer routes & progressive filling algorithm</div>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--cmd-adequate-green)", fontWeight: 600, marginTop: "8px" }}>Run Simulation →</span>
                </div>

                <div className="workflow-card" onClick={() => { setActiveView("report"); setReportInitialTab("submit"); }}>
                  <div>
                    <div className="workflow-idx">07 // ACTION</div>
                    <div className="workflow-title">Citizen Wastage Desk</div>
                    <div className="workflow-desc">Upload leak photos, GPS lock, track reference ID & MCD console</div>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--cmd-hydro-blue)", fontWeight: 600, marginTop: "8px" }}>Report Incident →</span>
                </div>
              </div>

              {/* Tactical Crisis Table */}
              <div className="cmd-table-container">
                <div className="cmd-table-header">
                  <div>
                    <div className="cmd-table-title">District Hydraulic Status Matrix</div>
                    <div className="cmd-table-subtitle">Live sensor readings vs algorithmic demand predictions across Thane Metropolitan Zones</div>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <button className="btn-cmd btn-cmd-secondary btn-cmd-sm" onClick={() => setActiveView("map")}>
                      <span>🗺️</span> View on GIS Map
                    </button>
                    <button className="btn-cmd btn-cmd-primary btn-cmd-sm" onClick={() => setActiveView("redistribution")}>
                      <span>⚡</span> Reallocate Supply
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="tactical-table">
                    <thead>
                      <tr>
                        <th>Zone Identifier</th>
                        <th style={{ textAlign: "right" }}>Predicted Demand</th>
                        <th style={{ textAlign: "right" }}>Available Supply</th>
                        <th style={{ textAlign: "right" }}>Estimated Shortage</th>
                        <th style={{ textAlign: "center" }}>Risk Tier</th>
                        <th style={{ textAlign: "center" }}>Sensor Anomaly Status</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zones.map((zone) => {
                        const shortage = JalsetuMath.calculateShortage(zone.predictedDemand, zone.availableSupply);
                        const risk = JalsetuMath.classifyRisk(zone.predictedDemand, zone.availableSupply);
                        const isBurstCorroborated = zone.id === "zone-b";

                        return (
                          <tr key={zone.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: "var(--cmd-text-heading)" }}>{zone.name}</div>
                              <div style={{ fontSize: "11px", color: "var(--cmd-text-muted)" }}>{zone.displayName}</div>
                            </td>
                            <td className="num-cell">
                              {JalsetuMath.formatNumber(zone.predictedDemand)} <span style={{ fontSize: "11px", color: "var(--cmd-text-subtle)" }}>L</span>
                            </td>
                            <td className="num-cell">
                              {JalsetuMath.formatNumber(zone.availableSupply)} <span style={{ fontSize: "11px", color: "var(--cmd-text-subtle)" }}>L</span>
                            </td>
                            <td className="num-cell" style={{ color: shortage > 0 ? "var(--cmd-critical-red)" : "var(--cmd-adequate-green)" }}>
                              {shortage > 0 ? `-${JalsetuMath.formatNumber(shortage)}` : "0"} <span style={{ fontSize: "11px" }}>L</span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {risk === "High" ? (
                                <span className="badge-tag critical">High Risk</span>
                              ) : risk === "Medium" ? (
                                <span className="badge-tag alert">Medium Risk</span>
                              ) : (
                                <span className="badge-tag adequate">Adequate</span>
                              )}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {isBurstCorroborated ? (
                                <span className="badge-tag critical" title="Corroborated by active citizen burst-pipe report">
                                  💥 Surge + Leak Pin
                                </span>
                              ) : zone.anomaly.detected ? (
                                <span className="badge-tag alert">
                                  ⚠️ Elev ({zone.anomaly.deviationPct}%)
                                </span>
                              ) : (
                                <span className="badge-tag adequate">Normal</span>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                className="btn-cmd btn-cmd-secondary btn-cmd-sm"
                                onClick={() => {
                                  setSelectedZoneFilter(zone.id);
                                  setActiveView("prediction");
                                }}
                              >
                                Forensics
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: DEMAND PREDICTION CONSOLE */}
          {activeView === "prediction" && (
            <div className="cmd-table-container">
              <div className="cmd-table-header">
                <div>
                  <div className="cmd-table-title">Forecasting & Temporal Scenario Console</div>
                  <div className="cmd-table-subtitle">LightGBM Multi-Step Recursive Engine vs Seasonal Naive Baseline</div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <select
                    className="cmd-select"
                    value={selectedHorizon}
                    onChange={(e) => setSelectedHorizon(e.target.value)}
                    aria-label="Select Forecast Horizon"
                  >
                    <option value="24h">24h Operational Horizon</option>
                    <option value="48h">48h Extended Horizon</option>
                    <option value="7d">7d Weekly Planning Scenario</option>
                  </select>

                  <select
                    className="cmd-select"
                    value={selectedZoneFilter}
                    onChange={(e) => setSelectedZoneFilter(e.target.value)}
                    aria-label="Filter Zone"
                  >
                    <option value="all">All Zones Aggregate</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name} ({z.displayName})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ padding: "var(--space-5)" }}>
                {/* Forecast Chart */}
                <div style={{ background: "#FFFFFF", border: "1px solid var(--cmd-border)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "var(--space-5)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--cmd-text-heading)" }}>
                        Demand Curve Decomposition ({selectedZoneFilter === "all" ? "District Profile" : zones.find(z => z.id === selectedZoneFilter)?.name})
                      </h3>
                      <span style={{ fontSize: "11px", color: "var(--cmd-text-muted)" }}>
                        Solid Navy = Historical Telemetry · Dashed Blue = LightGBM Model Prediction · Amber Line = Forecast Horizon Cutoff
                      </span>
                    </div>

                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--cmd-adequate-green)", fontWeight: 700 }}>
                      MODEL ACCURACY: sMAPE 4.2% (BEATS NAIVE 11.8%)
                    </div>
                  </div>

                  <ForecastSplitChart
                    labels={activeLabels}
                    forecastStartIndex={forecastStartIndex}
                    historicalData={activeSeries.historical}
                    forecastData={activeSeries.forecast}
                    zoneName={selectedZoneFilter === "all" ? "Thane District" : zones.find(z => z.id === selectedZoneFilter)?.name || "Zone"}
                  />
                </div>

                {/* Granular Breakdown Table */}
                <table className="tactical-table">
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th style={{ textAlign: "right" }}>Forecast Mean (L)</th>
                      <th style={{ textAlign: "right" }}>Peak Hour Draw (L)</th>
                      <th style={{ textAlign: "center" }}>Trend Vector</th>
                      <th style={{ textAlign: "right" }}>Variance vs Baseline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map((zone) => (
                      <tr key={zone.id}>
                        <td><strong>{zone.name}</strong> ({zone.displayName})</td>
                        <td className="num-cell">{JalsetuMath.formatNumber(zone.predictedDemand)} L</td>
                        <td className="num-cell" style={{ color: "var(--cmd-critical-red)" }}>
                          {JalsetuMath.formatNumber(Math.round(zone.predictedDemand * 0.082))} L/h
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: zone.trend === "Increase" ? "var(--cmd-critical-red)" : "var(--cmd-adequate-green)" }}>
                            {zone.trend === "Increase" ? "▲ RISING (+14%)" : zone.trend === "Decrease" ? "▼ RECEDING (-6%)" : "■ STABLE"}
                          </span>
                        </td>
                        <td className="num-cell">+{((zone.anomaly.deviationPct || 2.4)).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: ANOMALIES & SURGES */}
          {activeView === "anomalies" && (
            <div className="cmd-table-container">
              <div className="cmd-table-header">
                <div>
                  <div className="cmd-table-title">Forensic Anomaly & Surge Radar</div>
                  <div className="cmd-table-subtitle">Robust Residual Z-Score Scoring: <code>Score = (Actual − Expected) / (1.4826 × MAD)</code></div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <select
                    className="cmd-select"
                    value={anomalySeverityFilter}
                    onChange={(e) => setAnomalySeverityFilter(e.target.value)}
                  >
                    <option value="all">All Classifications</option>
                    <option value="High Alert">Pipe Surges (Critical)</option>
                    <option value="High">Sustained Elevated</option>
                    <option value="Normal">Within Normal Bands</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: "var(--space-5)" }}>
                {/* Forensic Surge Alert Card */}
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "var(--radius-md)", padding: "var(--space-4)", marginBottom: "var(--space-5)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <span className="badge-tag critical" style={{ marginBottom: "6px" }}>CRITICAL SURGE RADAR</span>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cmd-critical-text)", margin: "4px 0" }}>
                        Active Pipe Rupture Identified: Zone B (Central Commercial)
                      </h3>
                      <p style={{ fontSize: "13px", color: "var(--cmd-text-body)", margin: 0 }}>
                        Measured consumption is 850 L/h vs expected 520 L/h. Deviation: <strong>+42.0%</strong>. Statistical significance: <strong>4.8σ</strong>.
                      </p>
                    </div>

                    <button
                      className="btn-cmd btn-cmd-primary btn-cmd-sm"
                      onClick={() => { setActiveView("report"); setReportInitialTab("track"); }}
                    >
                      View Citizen Evidence Photo
                    </button>
                  </div>

                  <div style={{ background: "#FFFFFF", border: "1px dashed #FCA5A5", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: "12px", marginTop: "10px" }}>
                    🔍 <strong>Cross-Validation with Citizen Reports:</strong> Active report <code>MCD-2026-88F4A1</code> confirms underground feeder main burst at Majiwada Junction. Corroborates that surge is caused by physical leak loss, not civilian demand spike.
                  </div>
                </div>

                {/* Anomaly Classification Table */}
                <table className="tactical-table">
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Observed Draw</th>
                      <th>Expected MAD Range</th>
                      <th>Deviation (%)</th>
                      <th>Classification</th>
                      <th>Recommended Triage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones
                      .filter((z) => anomalySeverityFilter === "all" || z.anomaly.severity === anomalySeverityFilter)
                      .map((zone) => (
                        <tr key={zone.id}>
                          <td><strong>{zone.name}</strong> ({zone.displayName})</td>
                          <td className="num-cell">{zone.currentConsumption} L/h</td>
                          <td className="num-cell">{zone.normalRange[0]} – {zone.normalRange[1]} L/h</td>
                          <td className="num-cell" style={{ color: zone.anomaly.deviationPct > 15 ? "var(--cmd-critical-red)" : "inherit" }}>
                            {zone.anomaly.deviationPct > 0 ? `+${zone.anomaly.deviationPct}%` : `${zone.anomaly.deviationPct}%`}
                          </td>
                          <td>
                            {zone.anomaly.severity === "High Alert" ? (
                              <span className="badge-tag critical">Sudden Pipe Surge</span>
                            ) : zone.anomaly.severity === "High" ? (
                              <span className="badge-tag alert">Sustained Elevation</span>
                            ) : (
                              <span className="badge-tag adequate">Normal Profile</span>
                            )}
                          </td>
                          <td>
                            {zone.anomaly.severity === "High Alert" ? (
                              <span style={{ color: "var(--cmd-critical-red)", fontWeight: 600, fontSize: "12px" }}>Immediate Valve Throttle & Inspection</span>
                            ) : zone.anomaly.severity === "High" ? (
                              <span style={{ color: "var(--cmd-alert-amber)", fontWeight: 600, fontSize: "12px" }}>Monitor Sub-Distribution Nodes</span>
                            ) : (
                              <span style={{ color: "var(--cmd-adequate-green)", fontSize: "12px" }}>Standard Flow Rate</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 4: SHORTAGE MATRIX */}
          {activeView === "shortages" && (
            <div className="cmd-table-container">
              <div className="cmd-table-header">
                <div>
                  <div className="cmd-table-title">Municipal Shortage Deficit Matrix</div>
                  <div className="cmd-table-subtitle">Deterministic Shortage Calculation: <code>shortage_i = max(0, predicted_demand_i − available_supply_i)</code></div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <select
                    className="cmd-select"
                    value={shortageRiskFilter}
                    onChange={(e) => setShortageRiskFilter(e.target.value)}
                  >
                    <option value="all">All Risk Tiers</option>
                    <option value="High">High Deficit (≥ 20%)</option>
                    <option value="Medium">Medium Deficit (≥ 5%)</option>
                    <option value="Low">Low / Balanced</option>
                  </select>

                  <button
                    className="btn-cmd btn-cmd-secondary btn-cmd-sm"
                    onClick={() => setShortageSortAsc(!shortageSortAsc)}
                  >
                    Sort Deficit {shortageSortAsc ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              <div style={{ padding: "var(--space-5)" }}>
                <table className="tactical-table">
                  <thead>
                    <tr>
                      <th>Zone Name</th>
                      <th style={{ textAlign: "right" }}>Predicted Demand</th>
                      <th style={{ textAlign: "right" }}>Available Supply</th>
                      <th style={{ textAlign: "right" }}>Net Deficit</th>
                      <th style={{ textAlign: "right" }}>Deficit %</th>
                      <th style={{ textAlign: "center" }}>Risk Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones
                      .filter((z) => shortageRiskFilter === "all" || JalsetuMath.classifyRisk(z.predictedDemand, z.availableSupply) === shortageRiskFilter)
                      .sort((a, b) => {
                        const sA = JalsetuMath.calculateShortage(a.predictedDemand, a.availableSupply);
                        const sB = JalsetuMath.calculateShortage(b.predictedDemand, b.availableSupply);
                        return shortageSortAsc ? sA - sB : sB - sA;
                      })
                      .map((zone) => {
                        const shortage = JalsetuMath.calculateShortage(zone.predictedDemand, zone.availableSupply);
                        const risk = JalsetuMath.classifyRisk(zone.predictedDemand, zone.availableSupply);
                        const pct = ((shortage / (zone.predictedDemand || 1)) * 100).toFixed(1);

                        return (
                          <tr key={zone.id}>
                            <td><strong>{zone.name}</strong> ({zone.displayName})</td>
                            <td className="num-cell">{JalsetuMath.formatNumber(zone.predictedDemand)} L</td>
                            <td className="num-cell">{JalsetuMath.formatNumber(zone.availableSupply)} L</td>
                            <td className="num-cell" style={{ color: shortage > 0 ? "var(--cmd-critical-red)" : "var(--cmd-adequate-green)" }}>
                              {shortage > 0 ? `-${JalsetuMath.formatNumber(shortage)}` : "0"} L
                            </td>
                            <td className="num-cell">{pct}%</td>
                            <td style={{ textAlign: "center" }}>
                              {risk === "High" ? (
                                <span className="badge-tag critical">High Risk</span>
                              ) : risk === "Medium" ? (
                                <span className="badge-tag alert">Medium Risk</span>
                              ) : (
                                <span className="badge-tag adequate">Adequate</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 5: REDISTRIBUTION PLAN & HYDRAULIC SIMULATOR */}
          {activeView === "redistribution" && (
            <div className="cmd-table-container">
              <div className="cmd-table-header">
                <div>
                  <div className="cmd-table-title">Hydraulic Supply Redistribution Console</div>
                  <div className="cmd-table-subtitle">Weighted Progressive Water-Filling Optimizer · Invariant: Σ allocation_i ≤ Total Supply</div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    className="btn-cmd btn-cmd-primary btn-cmd-sm"
                    onClick={() => {
                      const csv = "zone,current_supply,recommended_allocation,net_transfer,remaining_shortage\n" +
                        redistributionPlan.map(z => `${z.name},${z.availableSupply},${z.recommendedAllocation},${z.netTransfer},${z.remainingShortage}`).join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `water_redistribution_plan_${new Date().toISOString().split("T")[0]}.csv`;
                      a.click();
                    }}
                  >
                    📥 Export Dispatch CSV
                  </button>
                </div>
              </div>

              <div style={{ padding: "var(--space-5)" }}>
                {/* Supply Regulator Slider */}
                <div style={{ background: "var(--cmd-surface-subtle)", border: "1px solid var(--cmd-border)", borderRadius: "var(--radius-md)", padding: "16px 20px", marginBottom: "var(--space-5)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--cmd-text-heading)" }}>
                        Total Municipal Available Supply Regulator
                      </span>
                      <div style={{ fontSize: "11px", color: "var(--cmd-text-muted)" }}>
                        Slide to test stress scenarios (Drought deficit vs Monsoon surplus)
                      </div>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 700, color: "var(--cmd-hydro-blue)" }}>
                      {JalsetuMath.formatNumber(totalAvailableSupply)} Litres
                    </span>
                  </div>

                  <input
                    type="range"
                    className="hydraulic-slider"
                    min="1000000"
                    max="3000000"
                    step="50000"
                    value={totalAvailableSupply}
                    onChange={(e) => setTotalAvailableSupply(parseInt(e.target.value, 10))}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--cmd-text-subtle)", marginTop: "6px", fontFamily: "var(--font-mono)" }}>
                    <span>CRITICAL DEFICIT (1.0M L)</span>
                    <span>BASELINE OPERATING (1.62M L)</span>
                    <span>SURPLUS CAPACITY (3.0M L)</span>
                  </div>
                </div>

                {/* Redistribution Results Table */}
                <table className="tactical-table">
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th style={{ textAlign: "right" }}>Current Supply</th>
                      <th style={{ textAlign: "right" }}>Recommended Flow Transfer</th>
                      <th style={{ textAlign: "right" }}>Rebalanced Supply</th>
                      <th style={{ textAlign: "right" }}>Remaining Shortage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redistributionPlan.map((zone) => {
                      const isTransferIn = zone.netTransfer > 0;
                      const isTransferOut = zone.netTransfer < 0;

                      return (
                        <tr key={zone.id}>
                          <td><strong>{zone.name}</strong></td>
                          <td className="num-cell">{JalsetuMath.formatNumber(zone.availableSupply)} L</td>
                          <td className="num-cell" style={{ color: isTransferIn ? "var(--cmd-adequate-green)" : isTransferOut ? "var(--cmd-critical-red)" : "inherit" }}>
                            {isTransferIn ? `+${JalsetuMath.formatNumber(zone.netTransfer)} L (RECEIVE)` : isTransferOut ? `${JalsetuMath.formatNumber(zone.netTransfer)} L (DONATE)` : "0 L"}
                          </td>
                          <td className="num-cell"><strong>{JalsetuMath.formatNumber(zone.recommendedAllocation)} L</strong></td>
                          <td className="num-cell" style={{ color: zone.remainingShortage > 0 ? "var(--cmd-critical-red)" : "var(--cmd-adequate-green)" }}>
                            {zone.remainingShortage > 0 ? `-${JalsetuMath.formatNumber(zone.remainingShortage)} L` : "0 L"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 6: GIS SPATIAL NETWORK MAP */}
          {activeView === "map" && (
            <div className="cmd-table-container">
              <div className="cmd-table-header">
                <div>
                  <div className="cmd-table-title">City Spatial GIS & Hydraulic Conduit Network</div>
                  <div className="cmd-table-subtitle">Real-time zone risks, proposed redistribution transfer vectors, and citizen wastage pins</div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    className={`btn-cmd ${simulationActive ? "btn-cmd-primary" : "btn-cmd-secondary"} btn-cmd-sm`}
                    onClick={() => setSimulationActive(!simulationActive)}
                  >
                    <span>{simulationActive ? "Hide Pipeline Conduits" : "⚡ Simulate Transfer Conduits"}</span>
                  </button>
                </div>
              </div>

              <div style={{ padding: "var(--space-5)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-4)" }}>
                  <div style={{ height: "460px", position: "relative" }}>
                    <InteractiveRiskMap
                      zones={zones}
                      reports={reports}
                      selectedZoneId={selectedMapZone?.id}
                      onSelectZone={(z) => setSelectedMapZone(z)}
                      simulationActive={simulationActive}
                      transferRoutes={telemetry?.transferRoutes || []}
                    />
                  </div>

                  {/* Diagnostic HUD */}
                  <div style={{ background: "var(--cmd-surface-subtle)", border: "1px solid var(--cmd-border)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <span className="badge-tag" style={{ background: "#E2E8F0", color: "#334155", marginBottom: "8px" }}>
                        DIAGNOSTIC HUD
                      </span>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cmd-text-heading)", margin: "4px 0" }}>
                        {selectedMapZone ? `${selectedMapZone.name} Diagnostics` : "Select a Zone"}
                      </h3>
                      {selectedMapZone && (
                        <div style={{ fontSize: "12px", color: "var(--cmd-text-muted)", marginBottom: "12px" }}>
                          {selectedMapZone.displayName} · Lat: {selectedMapZone.coordinates[0]}, Lon: {selectedMapZone.coordinates[1]}
                        </div>
                      )}

                      {selectedMapZone && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cmd-border-light)", paddingBottom: "4px" }}>
                            <span>Demand:</span> <strong className="num-cell">{JalsetuMath.formatNumber(selectedMapZone.predictedDemand)} L</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cmd-border-light)", paddingBottom: "4px" }}>
                            <span>Supply:</span> <strong className="num-cell">{JalsetuMath.formatNumber(selectedMapZone.availableSupply)} L</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cmd-border-light)", paddingBottom: "4px" }}>
                            <span>Shortage:</span> <strong className="num-cell" style={{ color: "var(--cmd-critical-red)" }}>
                              {JalsetuMath.formatNumber(JalsetuMath.calculateShortage(selectedMapZone.predictedDemand, selectedMapZone.availableSupply))} L
                            </strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Risk Tier:</span> <strong>{JalsetuMath.classifyRisk(selectedMapZone.predictedDemand, selectedMapZone.availableSupply)} Risk</strong>
                          </div>
                        </div>
                      )}

                      <hr style={{ border: 0, borderTop: "1px solid var(--cmd-border)", margin: "14px 0" }} />

                      <div style={{ fontSize: "12px" }}>
                        <strong>Active Incident Pin:</strong> 1 Burst Pipe reported in Zone B near Majiwada Junction flyover under MCD investigation.
                      </div>
                    </div>

                    {simulationActive && (
                      <div style={{ background: "#E0F2FE", border: "1px solid #BAE6FD", borderRadius: "var(--radius-sm)", padding: "10px", fontSize: "11px", color: "#0369A1" }}>
                        ✓ Transfer bypass conduit active: Zone A (Surplus) → Zone B (Deficit). Transfer capacity: 100,000 L.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 7: CITIZEN WATER WASTAGE REPORTING DESK */}
          {activeView === "report" && (
            <ReportWastageView
              reports={reports}
              zones={zones}
              onAddReport={handleAddReport}
              onUpdateReportStatus={handleUpdateReportStatus}
              initialTab={reportInitialTab}
            />
          )}

          {/* VIEW 8: ABOUT & OPERATIONAL SPECIFICATION */}
          {activeView === "about" && (
            <div className="cmd-table-container">
              <div className="cmd-table-header">
                <div>
                  <div className="cmd-table-title">Jalsetu WDMS · Municipal Operations & Technical Architecture</div>
                  <div className="cmd-table-subtitle">Core algorithmic specifications, LightGBM model metrics, and civil crisis protocols</div>
                </div>
              </div>

              <div style={{ padding: "var(--space-6)", lineHeight: "1.6" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: "var(--cmd-text-heading)" }}>
                  1. System Mission & Civic Purpose
                </h3>
                <p style={{ marginBottom: "16px", color: "var(--cmd-text-body)" }}>
                  Jalsetu is designed to eliminate systemic urban water shortages by unifying historical sensor telemetry, predictive LightGBM demand forecasting, real-time MAD anomaly detection, and progressive water-filling supply redistribution. It bridges municipal operations officers with citizen boots-on-the-ground reporting.
                </p>

                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: "var(--cmd-text-heading)" }}>
                  2. Core Algorithmic Framework
                </h3>
                <ul style={{ paddingLeft: "20px", marginBottom: "16px" }}>
                  <li><strong>Demand Forecast:</strong> Multi-step LightGBM regressor utilizing 1h, 24h, and 168h lag features with seasonal-naive benchmark comparison.</li>
                  <li><strong>Anomaly & Surge Radar:</strong> Robust z-scores computed via Median Absolute Deviation (MAD), distinguishing between sustained draw and sudden pipe ruptures.</li>
                  <li><strong>Shortage Estimation:</strong> Formulated as <code>shortage = max(0, predicted_demand − available_supply)</code>, categorizing zones into Low, Medium, and High risk tiers.</li>
                  <li><strong>Redistribution Optimization:</strong> Weighted progressive water-filling that respects pipeline constraints, caps each zone at expected demand, and prioritizes critical risk regions.</li>
                </ul>

                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: "var(--cmd-text-heading)" }}>
                  3. Authority & Citizen Engagement
                </h3>
                <p style={{ color: "var(--cmd-text-body)" }}>
                  Wastage reports submitted by citizens are received directly by the Municipal Corporation (MCD) Field Triage Division, providing immediate ground-truth verification for sensor-detected pipe surges.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* FOOTER */}
      <footer className="cmd-footer">
        <div className="cmd-container cmd-footer-inner">
          <div>
            <strong>JALSETU WDMS</strong> · Municipal Water Demand Management System · Thane Urban Command Div-04
          </div>
          <div>
            Authority: Municipal Corporation of Delhi (MCD) / Thane Water Board · 100% Deterministic Algorithms Verified
          </div>
        </div>
      </footer>

      {/* USER / ROLE SWITCH MODAL */}
      {isLoginModalOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(5, 19, 41, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={() => setIsLoginModalOpen(false)}
        >
          <div
            style={{ background: "#FFFFFF", borderRadius: "var(--radius-md)", border: "1px solid var(--cmd-border)", padding: "var(--space-6)", width: "100%", maxWidth: "440px", boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cmd-text-heading)", margin: 0 }}>
                Municipal Officer Credentials
              </h3>
              <button
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--cmd-text-muted)" }}
                onClick={() => setIsLoginModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRoleSwitch}>
              <div style={{ marginBottom: "var(--space-4)" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--cmd-text-muted)", display: "block", marginBottom: "4px" }}>
                  Select Preset Role:
                </label>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    type="button"
                    className={`btn-cmd ${selectedLoginRole === "operator" ? "btn-cmd-primary" : "btn-cmd-secondary"}`}
                    style={{ flex: 1 }}
                    onClick={() => { setSelectedLoginRole("operator"); setLoginEmail(ROLE_PRESETS.operator.email); }}
                  >
                    Chief Operator (SS)
                  </button>
                  <button
                    type="button"
                    className={`btn-cmd ${selectedLoginRole === "analyst" ? "btn-cmd-primary" : "btn-cmd-secondary"}`}
                    style={{ flex: 1 }}
                    onClick={() => { setSelectedLoginRole("analyst"); setLoginEmail(ROLE_PRESETS.analyst.email); }}
                  >
                    Water Analyst (AP)
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "var(--space-5)" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--cmd-text-muted)", display: "block", marginBottom: "4px" }}>
                  Officer Email:
                </label>
                <input
                  type="email"
                  className="cmd-input"
                  style={{ width: "100%" }}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                <button type="button" className="btn-cmd btn-cmd-secondary" onClick={() => setIsLoginModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-cmd btn-cmd-primary">
                  Switch Operational Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
