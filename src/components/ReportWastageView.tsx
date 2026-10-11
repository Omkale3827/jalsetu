"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { CitizenReport, Zone } from "@/lib/data";

const ReportLocationMap = dynamic(() => import("@/components/ReportLocationMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7FAFB", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
      <span style={{ color: "var(--color-primary)", fontSize: "13px" }}>Loading Map Pin Picker...</span>
    </div>
  )
});

interface ReportWastageViewProps {
  reports: CitizenReport[];
  zones: Zone[];
  onAddReport: (report: CitizenReport) => void;
  onUpdateReportStatus: (id: string, newStatus: CitizenReport["status"]) => void;
  initialTab?: "submit" | "track" | "mcd";
}

export default function ReportWastageView({
  reports,
  zones,
  onAddReport,
  onUpdateReportStatus,
  initialTab = "submit"
}: ReportWastageViewProps) {
  const [activeTab, setActiveTab] = useState<"submit" | "track" | "mcd">(initialTab);

  // Form State
  const [photos, setPhotos] = useState<Array<{ name: string; size: number; url: string }>>([]);
  const [lat, setLat] = useState<number>(19.1998);
  const [lon, setLon] = useState<number>(72.9640);
  const [hasLocationPinned, setHasLocationPinned] = useState<boolean>(true);
  const [addressText, setAddressText] = useState<string>("");
  const [category, setCategory] = useState<"burst_pipe" | "leak" | "overflow" | "other">("burst_pipe");
  const [severity, setSeverity] = useState<"minor" | "heavy">("heavy");
  const [description, setDescription] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Track State
  const [trackQueryId, setTrackQueryId] = useState<string>("");
  const [trackedReport, setTrackedReport] = useState<CitizenReport | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  // MCD Portal Passcode State
  const [mcdPasscode, setMcdPasscode] = useState<string>("");
  const [isMcdAuthenticated, setIsMcdAuthenticated] = useState<boolean>(false);
  const [mcdAuthError, setMcdAuthError] = useState<string | null>(null);
  const [mcdFilterStatus, setMcdFilterStatus] = useState<string>("all");

  // Handle Photo Uploads with validation (JPEG/PNG only, max 3 photos, max 5MB each)
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const files = e.target.files;
    if (!files) return;

    if (photos.length + files.length > 3) {
      setFormError("Maximum 3 photos allowed per report.");
      return;
    }

    const newPhotos = [...photos];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
        setFormError(`File "${file.name}" rejected: Only JPEG and PNG image files are accepted.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFormError(`File "${file.name}" exceeds the 5 MB limit.`);
        return;
      }

      // Convert to mock blob preview URL
      const url = URL.createObjectURL(file);
      newPhotos.push({
        name: file.name,
        size: Math.round(file.size / 1024),
        url
      });
    }

    setPhotos(newPhotos);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  // Browser Geolocation
  const handleUseMyLocation = () => {
    setFormError(null);
    if (!navigator.geolocation) {
      setFormError("Geolocation is not supported by your browser. Please type an address or drag the pin.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLon(Number(pos.coords.longitude.toFixed(5)));
        setHasLocationPinned(true);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setFormError("Location permission denied or unavailable. You can still set location by entering an address or clicking the map.");
      },
      { timeout: 8000 }
    );
  };

  // Find nearest zone if available
  const findNearestZone = (targetLat: number, targetLon: number) => {
    if (!zones || zones.length === 0) return null;
    let closestZone = zones[0];
    let minDistance = Number.MAX_VALUE;

    zones.forEach((z) => {
      const d = Math.hypot(z.coordinates[0] - targetLat, z.coordinates[1] - targetLon);
      if (d < minDistance) {
        minDistance = d;
        closestZone = z;
      }
    });

    return closestZone;
  };

  // Form Submit
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate location requirement
    if (!hasLocationPinned && !addressText.trim()) {
      setFormError("Location is required. Please mark on the map, use 'Use my location', or enter an address.");
      return;
    }

    // Generate unique Report ID
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newId = `MCD-2026-${randomHex}`;

    const nearest = findNearestZone(lat, lon);

    const newReport: CitizenReport = {
      id: newId,
      timestamp: new Date().toISOString(),
      lat,
      lon,
      addressText: addressText.trim() || undefined,
      zoneId: nearest?.id || "zone-b",
      zoneName: nearest?.displayName || "Zone B (Central Commercial)",
      category,
      severity,
      description: description.trim() || `Reported ${category.replace("_", " ")} leak`,
      photos: photos.map((p) => p.url),
      status: "submitted",
      receivedBy: "MCD"
    };

    onAddReport(newReport);
    setSubmittedReportId(newId);
  };

  // Reset form for another report
  const handleResetForm = () => {
    setPhotos([]);
    setDescription("");
    setAddressText("");
    setSubmittedReportId(null);
    setFormError(null);
  };

  // Track status lookup
  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError(null);
    const cleanId = trackQueryId.trim().toUpperCase();
    if (!cleanId) {
      setTrackError("Please enter a valid Report ID (e.g. MCD-2026-88F4A1)");
      return;
    }

    const found = reports.find((r) => r.id.toUpperCase() === cleanId);
    if (found) {
      setTrackedReport(found);
    } else {
      setTrackedReport(null);
      setTrackError(`Report reference "${cleanId}" not found. Please verify your reference number.`);
    }
  };

  // MCD Authentication
  const handleMcdAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (mcdPasscode.trim().toUpperCase() === "MCD2026") {
      setIsMcdAuthenticated(true);
      setMcdAuthError(null);
    } else {
      setMcdAuthError("Invalid MCD Officer Passcode. (Demo Passcode: MCD2026)");
    }
  };

  // Export CSV for MCD
  const handleExportMcdCsv = () => {
    const headers = [
      "id",
      "timestamp",
      "lat",
      "lon",
      "address_text",
      "zone_id",
      "category",
      "severity",
      "description",
      "status",
      "received_by"
    ];

    const rows = reports.map((r) => [
      `"${r.id}"`,
      `"${r.timestamp}"`,
      r.lat,
      r.lon,
      `"${(r.addressText || "").replace(/"/g, '""')}"`,
      `"${r.zoneId || ""}"`,
      `"${r.category}"`,
      `"${r.severity || ""}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.receivedBy}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mcd_water_wastage_reports_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: CitizenReport["status"]) => {
    switch (status) {
      case "submitted":
        return <span className="status-pill status-info">Submitted</span>;
      case "in_review":
        return <span className="status-pill status-warning">In Review</span>;
      case "actioned":
        return <span className="status-pill status-alert">Actioned / Dispatched</span>;
      case "resolved":
        return <span className="status-pill status-adequate">Resolved</span>;
      case "dismissed":
        return <span className="status-pill" style={{ background: "#E9ECEF", color: "#495057" }}>Dismissed</span>;
    }
  };

  const filteredMcdReports = reports.filter((r) => {
    if (mcdFilterStatus === "all") return true;
    return r.status === mcdFilterStatus;
  });

  return (
    <section className="page-view active" aria-labelledby="report-section-title">
      <div className="section-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 id="report-section-title" className="section-title">Citizen Water Wastage Reporting & Triage</h1>
          <p className="section-subtitle">
            Report burst pipes, active leaks, and overflows directly to the Municipal Corporation (MCD) for rapid response
          </p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: "flex", gap: "var(--space-2)", background: "#FFFFFF", padding: "4px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "submit" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("submit")}
          >
            Report Leak
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "track" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("track")}
          >
            Track Status
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "mcd" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("mcd")}
            title="Passcode-protected view for Municipal Corporation officers"
          >
            🔒 MCD Reports
          </button>
        </div>
      </div>

      {/* TAB 1: SUBMIT REPORT */}
      {activeTab === "submit" && (
        <div className="card" style={{ maxWidth: "860px", margin: "0 auto" }}>
          {submittedReportId ? (
            <div style={{ textAlign: "center", padding: "var(--space-8) var(--space-4)" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#D5F6D8", color: "#14632F", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-4) auto" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
                Wastage Report Submitted Successfully
              </h2>
              <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
                Your report has been received by the Municipal Corporation (MCD) Field Triage Division.
              </p>

              <div style={{ background: "#F3F8FE", border: "1px dashed var(--color-primary)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", display: "inline-block", marginBottom: "var(--space-6)" }}>
                <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, display: "block" }}>
                  Your Official Report Reference ID
                </span>
                <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-primary)", fontFamily: "monospace" }}>
                  {submittedReportId}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setTrackQueryId(submittedReportId);
                    setActiveTab("track");
                    const found = reports.find((r) => r.id === submittedReportId);
                    if (found) setTrackedReport(found);
                  }}
                >
                  Track This Report
                </button>
                <button className="btn btn-secondary" onClick={handleResetForm}>
                  Submit Another Report
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitReport}>
              <div className="card-header" style={{ marginBottom: "var(--space-4)" }}>
                <div>
                  <h2 className="card-title">Citizen Wastage Submission Form</h2>
                  <p className="card-subtitle">
                    Fast-track municipal repair by providing photo evidence and exact coordinates. Does not require forecast data.
                  </p>
                </div>
                <span className="status-pill status-info">Authority: MCD</span>
              </div>

              {formError && (
                <div style={{ background: "#FDC8C8", color: "#9B1C2C", padding: "12px 16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-5)", fontSize: "14px", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }} role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Category Chips */}
              <div className="form-group" style={{ marginBottom: "var(--space-5)" }}>
                <label className="form-label" style={{ fontWeight: 600 }}>1. Problem Category</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "6px" }} role="radiogroup" aria-label="Wastage category">
                  {[
                    { id: "burst_pipe", label: "Burst Pipe", icon: "💥" },
                    { id: "leak", label: "Leak", icon: "💧" },
                    { id: "overflow", label: "Tank / Drain Overflow", icon: "🌊" },
                    { id: "other", label: "Other Wastage", icon: "⚠️" }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      role="radio"
                      aria-checked={category === cat.id}
                      onClick={() => setCategory(cat.id as any)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "999px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        border: category === cat.id ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                        background: category === cat.id ? "#EBF5FE" : "#FFFFFF",
                        color: category === cat.id ? "var(--color-primary)" : "var(--color-text-primary)",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Severity Selector */}
              <div className="form-group" style={{ marginBottom: "var(--space-5)" }}>
                <label className="form-label" style={{ fontWeight: 600 }}>2. Observed Severity</label>
                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "6px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", background: severity === "minor" ? "#F7FAFB" : "#FFFFFF", padding: "10px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", flex: 1 }}>
                    <input
                      type="radio"
                      name="severity"
                      value="minor"
                      checked={severity === "minor"}
                      onChange={() => setSeverity("minor")}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text-primary)" }}>Minor Leak</div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Slow drip or low-pressure seepage</div>
                    </div>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", background: severity === "heavy" ? "#FDF5F8" : "#FFFFFF", padding: "10px 16px", borderRadius: "var(--radius-sm)", border: severity === "heavy" ? "1px solid #FFA8A8" : "1px solid var(--color-border)", flex: 1 }}>
                    <input
                      type="radio"
                      name="severity"
                      value="heavy"
                      checked={severity === "heavy"}
                      onChange={() => setSeverity("heavy")}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#C62828" }}>Heavy Flow / Gushing</div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>High-pressure geyser or road flooding</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 3. Photo Drop Zone */}
              <div className="form-group" style={{ marginBottom: "var(--space-5)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>3. Photo Evidence (1–3 Photos, Max 5 MB each)</label>
                  <span style={{ fontSize: "11px", color: "#0CA678", fontWeight: 600 }}>🔒 EXIF Metadata Stripped for Privacy</span>
                </div>

                <div
                  style={{
                    border: "2px dashed #B9D1EC",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-5)",
                    textAlign: "center",
                    background: "#F7FAFB",
                    position: "relative",
                    cursor: "pointer"
                  }}
                  onClick={() => document.getElementById("photo-upload-input")?.click()}
                >
                  <input
                    id="photo-upload-input"
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    multiple
                    style={{ display: "none" }}
                    onChange={handlePhotoSelect}
                  />
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#E8F3FE", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-2) auto" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-primary)" }}>
                    Click or Drag to Upload Photos
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                    Supports PNG & JPEG formats only (Up to 3 images)
                  </div>
                </div>

                {photos.length > 0 && (
                  <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
                    {photos.map((p, idx) => (
                      <div key={idx} style={{ position: "relative", width: "80px", height: "80px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--color-border)" }}>
                        <img src={p.url} alt={`Upload preview ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemovePhoto(idx); }}
                          style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.6)", color: "#FFFFFF", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}
                          aria-label={`Remove photo ${idx + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Location Picker */}
              <div className="form-group" style={{ marginBottom: "var(--space-5)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>4. Incident Location (Mandatory)</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleUseMyLocation}
                    disabled={isLocating}
                    style={{ display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <span>📍</span>
                    <span>{isLocating ? "Detecting GPS..." : "Use My Location"}</span>
                  </button>
                </div>

                <ReportLocationMap
                  lat={lat}
                  lon={lon}
                  onChangeLocation={(newLat, newLon) => {
                    setLat(newLat);
                    setLon(newLon);
                    setHasLocationPinned(true);
                  }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  <span id="coord-readout" aria-live="polite">
                    Coordinates: <strong>{lat.toFixed(5)}° N, {lon.toFixed(5)}° E</strong> (Click map or drag pin)
                  </span>
                  {findNearestZone(lat, lon) && (
                    <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                      Nearest Municipal Zone: {findNearestZone(lat, lon)?.name}
                    </span>
                  )}
                </div>

                {/* Accessible text fallback */}
                <div style={{ marginTop: "var(--space-3)" }}>
                  <label htmlFor="address-landmark-input" className="form-label" style={{ fontSize: "12px" }}>
                    Street Address or Landmark (Optional / Accessibility Fallback)
                  </label>
                  <input
                    id="address-landmark-input"
                    type="text"
                    className="form-select"
                    placeholder="e.g. Near Ghodbunder Road Service Lane, Sector 4 Junction"
                    value={addressText}
                    maxLength={200}
                    onChange={(e) => setAddressText(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {/* 5. Description */}
              <div className="form-group" style={{ marginBottom: "var(--space-6)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label htmlFor="description-input" className="form-label" style={{ fontWeight: 600 }}>5. Problem Description</label>
                  <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{description.length} / 500</span>
                </div>
                <textarea
                  id="description-input"
                  rows={3}
                  className="form-select"
                  placeholder="Describe the leak location, estimated water loss, or physical landmark..."
                  value={description}
                  maxLength={500}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: "100%", resize: "vertical", height: "auto" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
                <button type="submit" className="btn btn-primary" style={{ padding: "10px 24px" }}>
                  Submit Water Wastage Report
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: TRACK STATUS */}
      {activeTab === "track" && (
        <div className="card" style={{ maxWidth: "720px", margin: "0 auto" }}>
          <div className="card-header" style={{ marginBottom: "var(--space-5)" }}>
            <div>
              <h2 className="card-title">Track Incident Resolution</h2>
              <p className="card-subtitle">Enter your official MCD report reference code to inspect real-time repair progress</p>
            </div>
          </div>

          <form onSubmit={handleTrackSubmit} style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
            <input
              type="text"
              className="form-select"
              placeholder="e.g. MCD-2026-88F4A1"
              value={trackQueryId}
              onChange={(e) => setTrackQueryId(e.target.value)}
              style={{ flex: 1, fontFamily: "monospace", fontSize: "15px", textTransform: "uppercase" }}
              aria-label="Report Reference ID"
            />
            <button type="submit" className="btn btn-primary">Check Status</button>
          </form>

          {trackError && (
            <div style={{ background: "#FDC8C8", color: "#9B1C2C", padding: "12px 16px", borderRadius: "var(--radius-md)", fontSize: "14px", fontWeight: 500 }} role="alert">
              {trackError}
            </div>
          )}

          {trackedReport && (
            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-5)", background: "#F7FAFB" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-4)" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>Report ID</span>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text-primary)", fontFamily: "monospace", margin: "2px 0 0 0" }}>
                    {trackedReport.id}
                  </h3>
                </div>
                {getStatusBadge(trackedReport.status)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", fontSize: "13px", marginBottom: "var(--space-4)" }}>
                <div><strong>Authority:</strong> {trackedReport.receivedBy} Water Management Board</div>
                <div><strong>Category:</strong> {trackedReport.category.replace("_", " ").toUpperCase()}</div>
                <div><strong>Severity:</strong> {trackedReport.severity?.toUpperCase() || "UNSPECIFIED"}</div>
                <div><strong>Logged Timestamp:</strong> {new Date(trackedReport.timestamp).toLocaleString()}</div>
                <div><strong>Coordinates:</strong> {trackedReport.lat}° N, {trackedReport.lon}° E</div>
                <div><strong>Municipal Zone:</strong> {trackedReport.zoneName || "Zone B"}</div>
              </div>

              {trackedReport.addressText && (
                <div style={{ fontSize: "13px", marginBottom: "var(--space-4)", background: "#FFFFFF", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                  <strong>Landmark:</strong> {trackedReport.addressText}
                </div>
              )}

              <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", background: "#FFFFFF", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <strong>Description:</strong> {trackedReport.description}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MCD REVIEW VIEW (PROTECTED) */}
      {activeTab === "mcd" && (
        <div>
          {!isMcdAuthenticated ? (
            <div className="card" style={{ maxWidth: "480px", margin: "0 auto", textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#E8F3FE", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-3) auto" }}>
                🔒
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
                MCD Officer Portal Access
              </h2>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "var(--space-5)" }}>
                Enter the Municipal Corporation staff passcode to review triage queues and dispatch field repairs.
              </p>

              <form onSubmit={handleMcdAuth}>
                <input
                  type="password"
                  className="form-select"
                  placeholder="Enter Passcode (Demo: MCD2026)"
                  value={mcdPasscode}
                  onChange={(e) => setMcdPasscode(e.target.value)}
                  style={{ width: "100%", marginBottom: "var(--space-4)", textAlign: "center", fontSize: "16px" }}
                />
                {mcdAuthError && (
                  <div style={{ color: "#C62828", fontSize: "12px", fontWeight: 600, marginBottom: "var(--space-3)" }}>
                    {mcdAuthError}
                  </div>
                )}
                <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                  Unlock MCD Triage Portal
                </button>
              </form>
            </div>
          ) : (
            <div className="card">
              <div className="card-header" style={{ marginBottom: "var(--space-5)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h2 className="card-title">MCD Field Triage & Resolution Console</h2>
                    <span className="status-pill status-adequate" style={{ fontSize: "11px" }}>Authorized Staff</span>
                  </div>
                  <p className="card-subtitle">
                    Manage citizen reports, dispatch repair teams, and export incident records for the Delhi/Thane Water Board.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  <select
                    className="form-select"
                    value={mcdFilterStatus}
                    onChange={(e) => setMcdFilterStatus(e.target.value)}
                    style={{ fontSize: "13px" }}
                    aria-label="Filter by Status"
                  >
                    <option value="all">All Statuses ({reports.length})</option>
                    <option value="submitted">Submitted</option>
                    <option value="in_review">In Review</option>
                    <option value="actioned">Actioned / Dispatched</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>

                  <button className="btn btn-secondary btn-sm" onClick={handleExportMcdCsv}>
                    📥 Export CSV
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Report ID</th>
                      <th>Logged At</th>
                      <th>Category & Severity</th>
                      <th>Location / Zone</th>
                      <th>Problem Summary</th>
                      <th>Status Triage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMcdReports.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--color-text-secondary)" }}>
                          No reports match the selected triage filter.
                        </td>
                      </tr>
                    ) : (
                      filteredMcdReports.map((report) => (
                        <tr key={report.id}>
                          <td style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--color-primary)" }}>
                            {report.id}
                          </td>
                          <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                            {new Date(report.timestamp).toLocaleDateString()} {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{report.category.replace("_", " ").toUpperCase()}</div>
                            <span style={{ fontSize: "11px", color: report.severity === "heavy" ? "#C62828" : "#5A6B8B", fontWeight: 600 }}>
                              {report.severity === "heavy" ? "Heavy Gush" : "Minor Seepage"}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{report.zoneName || "Zone B"}</div>
                            <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                              {report.lat.toFixed(4)}° N, {report.lon.toFixed(4)}° E
                            </div>
                            {report.addressText && (
                              <div style={{ fontSize: "11px", color: "#0867C4", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={report.addressText}>
                                {report.addressText}
                              </div>
                            )}
                          </td>
                          <td style={{ maxWidth: "240px", fontSize: "12px" }}>
                            {report.description}
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={report.status}
                              onChange={(e) => onUpdateReportStatus(report.id, e.target.value as any)}
                              style={{ fontSize: "12px", padding: "4px 8px", minWidth: "130px" }}
                              aria-label={`Change status for report ${report.id}`}
                            >
                              <option value="submitted">Submitted</option>
                              <option value="in_review">In Review</option>
                              <option value="actioned">Actioned / Dispatched</option>
                              <option value="resolved">Resolved</option>
                              <option value="dismissed">Dismissed</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
