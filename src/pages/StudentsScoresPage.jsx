import React from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import useStudentsData from "../components/Students";
import useCohorts from "../components/useCohorts";
import "../App.css";

export default function StudentsScoresPage() {
  const location = useLocation();
  const { data, loading, error } = useStudentsData();
  const { cohorts, loadingCohorts, errorCohorts } = useCohorts();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [uploadError, setUploadError] = React.useState("");


  // Normalize API data to an array to keep iterables safe for memos
  const safeData = Array.isArray(data) ? data : [];

  // Track route transitions so we can avoid showing empty-state mid-transition
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const lastPathRef = React.useRef(location.pathname);

  // Start a transition when the pathname changes
  React.useEffect(() => {
    if (location.pathname !== lastPathRef.current) {
      lastPathRef.current = location.pathname;
      setIsTransitioning(true);
    }
  }, [location.pathname]);

  // End transition when the fetch settles (loading flips to false)
  React.useEffect(() => {
    if (!loading) setIsTransitioning(false);
  }, [loading]);

  // Cache the last non-empty dataset to display during transitions
  const prevNonEmptyRef = React.useRef([]);
  React.useEffect(() => {
    if (safeData.length > 0) prevNonEmptyRef.current = safeData;
  }, [safeData]);

  // UI-facing data: keep previous non-empty while transitioning, else current
  const scores = isTransitioning && prevNonEmptyRef.current.length
    ? prevNonEmptyRef.current
    : safeData;

  // Controlled UI state
  const [selectedCohort, setSelectedCohort] = React.useState("");
  React.useEffect(() => {
    if (!selectedCohort && cohorts.length) setSelectedCohort(cohorts[0]);
  }, [cohorts, selectedCohort]);

  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 180);
    return () => clearTimeout(id);
  }, [query]);

  // Column visibility controls
  const HIDABLE_META = [
    { key: "COHORT", label: "Cohort" },
    { key: "SEM", label: "Sem" },
    { key: "CU_ID", label: "CU ID" },
    { key: "MATRIC_NO", label: "Matric No" },
  ];

  const [hiddenMeta, setHiddenMeta] = React.useState(() => {
    const raw = localStorage.getItem("scores.hiddenMeta");
    try {
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  React.useEffect(() => {
    localStorage.setItem("scores.hiddenMeta", JSON.stringify(Array.from(hiddenMeta)));
  }, [hiddenMeta]);

  const toggleHidden = (key) => {
    setHiddenMeta((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 1) Filter by cohort
  // Derived data with safe iterables
  const filteredScores = React.useMemo(() => {
    const base = scores; // always an array
    if (!selectedCohort) return base;
    return base.filter((r) => {
      const raw = r?.COHORT;
      if (!raw) return false;
      const d = new Date(raw);
      const y = Number.isFinite(d.getTime()) ? d.getFullYear() : Number(raw);
      return String(y) === selectedCohort;
    });
  }, [scores, selectedCohort]);

  // 2) Build metadata
  const metaByMatric = React.useMemo(() => {
    const m = new Map();
    for (const r of filteredScores) {
      if (!r) continue;
      const key = String(r.MATRIC_NO ?? "-");
      if (!m.has(key)) {
        m.set(key, {
          MATRIC_NO: key,
          STUDENT_NAME: r.STUDENT_NAME ?? "-",
          COHORT: (() => {
            const raw = r.COHORT;
            if (!raw) return "-";
            const d = new Date(raw);
            const y = Number.isFinite(d.getTime()) ? d.getFullYear() : Number(raw);
            return Number.isFinite(y) ? String(y) : "-";
          })(),
          SEM: r.SEM ?? "-",
          CU_ID: r.CU_ID ?? "-",
        });
      }
    }
    return m;
  }, [filteredScores]);

  const nameIndex = React.useMemo(() => {
    const idx = new Map();
    for (const [matric, meta] of metaByMatric.entries()) {
      idx.set(matric, String(meta?.STUDENT_NAME ?? "").toLowerCase());
    }
    return idx;
  }, [metaByMatric]);

  // 3) Course codes
  const courseCodes = React.useMemo(() => {
    const set = new Set();
    for (const r of filteredScores) {
      if (r && r.COURSE_CODE) set.add(String(r.COURSE_CODE));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredScores]);

  // 4) Pivot attempts and sort by student name
  const pivoted = React.useMemo(() => {
    const byMatric = {};
    for (const r of filteredScores) {
      if (!r) continue;
      const m = String(r.MATRIC_NO ?? "-");
      const c = String(r.COURSE_CODE ?? "");
      if (!byMatric[m]) byMatric[m] = {};
      byMatric[m][c] = [r.ATTEMPT_1 ?? null, r.ATTEMPT_2 ?? null, r.ATTEMPT_3 ?? null];
    }
    const rows = Object.keys(byMatric).map((m) => ({
      MATRIC_NO: m,
      meta:
        metaByMatric.get(m) ?? {
          MATRIC_NO: m,
          STUDENT_NAME: "-",
          COHORT: "-",
          SEM: "-",
          CU_ID: "-",
        },
      courses: byMatric[m],
    }));
    return rows.sort((a, b) => {
      const an = (a.meta.STUDENT_NAME ?? "").trim();
      const bn = (b.meta.STUDENT_NAME ?? "").trim();
      const cmp = an.localeCompare(bn, undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
      return String(a.MATRIC_NO).localeCompare(String(b.MATRIC_NO), undefined, { sensitivity: "base" });
    });
  }, [filteredScores, metaByMatric]);

  // 6) Hide attempt 3 for courses that contain any 'N/A' attempt_3
  const hideAttempt3ByCourse = React.useMemo(() => {
    const m = new Map();
    for (const r of filteredScores) {
      if (!r || !r.COURSE_CODE) continue;
      const code = String(r.COURSE_CODE);
      const v3 = r.ATTEMPT_3;
      if (typeof v3 === "string" && v3.trim().toUpperCase() === "N/A") {
        m.set(code, true);
      } else if (!m.has(code)) {
        m.set(code, false);
      }
    }
    return m;
  }, [filteredScores]);

  // 5) Formatting helper
  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return "-";
    if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : "-";
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.toLowerCase() === "exempted") return "N/A";
      if (/^[A-Za-z]\d{2}-\d+$/.test(trimmed)) return trimmed;
      const num = Number(trimmed);
      return Number.isFinite(num) ? Math.round(num * 100) / 100 : trimmed;
    }
    const num = Number(v);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : "-";
  };

  // Layout constants
  const headerHeights = { row1: 32, row2: 24 };
  const containerStyle = { margin: "20px auto", maxWidth: "95%", width: "fit-content" };
  const scrollerStyle = {
    maxHeight: "calc(100vh - 150px)",
    overflow: "auto",
    position: "relative",
    border: "1px solid #ddd",
    borderRadius: "4px",
    margin: "0 auto",
    minWidth: "800px",
    maxWidth: "100%",
  };
  const tableStyle = { width: "100%", tableLayout: "auto", borderCollapse: "separate" };
  const thBase = {
    background: "#f8f9fa",
    border: "1px solid #ddd",
    textAlign: "center",
    padding: "8px 10px",
    whiteSpace: "nowrap",
  };
  const thStickyTopRow1 = { ...thBase, background: "#f8f9fa" };
  const thStickyTopRow2 = { ...thBase, background: "#f8f9fa" };
  const theadStyle = {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "#ffffffff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  };
  const tdAttempt = {
    textAlign: "center",
    padding: "6px 10px",
    borderTop: "1px solid #eee",
    whiteSpace: "nowrap",
    verticalAlign: "top",
    borderLeft: "1px solid #f1f1f1",
    minWidth: 64,
    maxWidth: 64,
  };

  const [colsMenuOpen, setColsMenuOpen] = React.useState(false);

  // dynamic name width measuring
  const getTableFont = () => {
    const size = 14;
    const family = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    const weight = "400";
    return `${weight} ${size}px ${family}`;
  };
  const measureTextWidth = React.useCallback((text, font) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = font;
    const m = ctx.measureText(String(text ?? ""));
    return Math.ceil(m.width);
  }, []);
  const nameColumnWidth = React.useMemo(() => {
    const font = getTableFont();
    let maxW = 0;
    for (const v of metaByMatric.values()) {
      maxW = Math.max(maxW, measureTextWidth(v.STUDENT_NAME ?? "-", font));
    }
    const padding = 20;
    const buffer = 24;
    const computed = maxW + padding + buffer;
    return Math.max(160, Math.min(420, computed));
  }, [metaByMatric, measureTextWidth]);

  // visible meta indices from hiddenMeta (Name always visible)
  const visibleMetaIdxs = React.useMemo(() => {
    const base = [0];
    if (!hiddenMeta.has("COHORT")) base.push(1);
    if (!hiddenMeta.has("SEM")) base.push(2);
    if (!hiddenMeta.has("CU_ID")) base.push(3);
    if (!hiddenMeta.has("MATRIC_NO")) base.push(4);
    return base;
  }, [hiddenMeta]);

  // sticky helpers
  const stickyThStyle = (slot) => ({
    ...thBase,
    position: "sticky",
    top: 0,
    left: metaLeftOffsets[slot],
    zIndex: 21,
    minWidth: metaWidths[slot],
    maxWidth: metaWidths[slot],
  });
  const stickyTdStyle = (slot) => ({
    position: "sticky",
    left: metaLeftOffsets[slot],
    background: "white",
    zIndex: 18,
    borderRight: "1px solid #eee",
    textAlign: slot === 0 ? "left" : "center",
    padding: "6px 10px",
    minWidth: metaWidths[slot],
    maxWidth: metaWidths[slot],
    whiteSpace: "nowrap",
  });

  // widths & offsets for sticky meta columns
  const baseWidths = React.useMemo(() => [nameColumnWidth, 90, 70, 110, 120], [nameColumnWidth]);
  const metaWidths = React.useMemo(() => visibleMetaIdxs.map((i) => baseWidths[i]), [visibleMetaIdxs, baseWidths]);
  const metaLeftOffsets = React.useMemo(() => {
    const arr = [];
    let acc = 0;
    for (let i = 0; i < metaWidths.length; i++) {
      arr.push(acc);
      acc += metaWidths[i];
    }
    return arr;
  }, [metaWidths]);

  const highlight = React.useCallback((text) => {
    if (!debouncedQuery) return text;
    const t = String(text ?? "");
    const q = debouncedQuery;
    const lower = t.toLowerCase();
    const parts = [];
    let i = 0;
    let pos;
    while ((pos = lower.indexOf(q, i)) !== -1) {
      if (pos > i) parts.push(t.slice(i, pos));
      parts.push(<mark key={pos}>{t.slice(pos, pos + q.length)}</mark>);
      i = pos + q.length;
    }
    if (i < t.length) parts.push(t.slice(i));
    return <>{parts}</>;
  }, [debouncedQuery]);

  const visibleRows = React.useMemo(() => {
    if (!debouncedQuery) return pivoted;
    return pivoted.filter((r) => {
      const nm = nameIndex.get(r.MATRIC_NO) || "";
      return nm.includes(debouncedQuery);
    });
  }, [pivoted, debouncedQuery, nameIndex]);

//   // Upload submit handler
  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      setUploadError("Please choose an .xlsm file first.");
      return;
    }
    const ok =
      selectedFile.name.toLowerCase().endsWith(".xlsm") ||
      (selectedFile.type || "").includes("macroEnabled");
    if (!ok) {
      setUploadError("Only .xlsm files are allowed.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await fetch("http://localhost:5001/api/import-marksheet", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${res.status} ${text}`);
      }
      const json = await res.json();
      console.log("Import result:", json);
      setUploadOpen(false);
      setSelectedFile(null);
      setUploadError("");
      // TODO: trigger data reload; simplest:
      // window.location.reload();
    } catch (e) {
      setUploadError(e.message || "Upload failed");
    }
  };


  // Early returns: suppress empty-state while transitioning/loading without prior data
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (loading && prevNonEmptyRef.current.length === 0) return <p>Loading...</p>;
  if (!loading && scores.length === 0) return <p>No data found</p>;

  return (
    <div className="flex h-screen w-screen">
      <Sidebar />
      <div className="flex-1 p-8 w-full overflow-hidden"> {/*overflow-auto to display page scrollbar*/}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Toolbar OUTSIDE the scroller */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 200,
              background: "white",
              paddingBottom: 4,
            }}
          >
            {/* Grid container with two rows */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateAreas: `
                  "cohort  cohort"
                  ".       actions"
                `,
                rowGap: 8,
                columnGap: 12,
                alignItems: "center",
              }}
            >
              {/* Row 1: Cohort left, spanning both columns */}
              <div style={{ gridArea: "cohort", display: "flex", alignItems: "center", gap: 10 }}>
                <label htmlFor="cohort">Cohort:</label>
                <select
                  id="cohort"
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                >
                  {cohorts.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                {loadingCohorts && <span>Loading cohorts…</span>}
                {errorCohorts && <span style={{ color: "red" }}>Failed to load cohorts</span>}
              </div>

              {/* Row 2: Actions aligned to the right; Columns left of Search, Search at far right */}
              <div
                style={{
                  gridArea: "actions",
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 10,
                  position: "relative", // anchor for the dropdown
                  zIndex: 300,
                }}
              >
                {/* Columns button (left) */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setColsMenuOpen((v) => !v)}
                    className="border px-3 py-1 rounded"
                    aria-expanded={colsMenuOpen}
                    title="Show/Hide columns"
                  >
                    Columns
                  </button>

                  {colsMenuOpen && (
                    <div
                      role="menu"
                      style={{
                        position: "absolute",
                        right: 0,
                        marginTop: 6,
                        background: "white",
                        border: "1px solid #ddd",
                        borderRadius: 6,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                        padding: 8,
                        minWidth: 180,
                        zIndex: 310,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Show/Hide columns</div>
                      {HIDABLE_META.map(({ key, label }) => (
                        <label
                          key={key}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenMeta.has(key)}
                            onChange={() => toggleHidden(key)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                        <button onClick={() => setColsMenuOpen(false)} className="border px-2 py-1 rounded">
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload (middle) */}
                <button
                  onClick={() => { setSelectedFile(null); setUploadError(""); setUploadOpen(true); }}
                  className="border px-3 py-1 rounded"
                  title="Upload .xlsm file"
                >
                  Import Marksheet
                </button>

                {/* Search (rightmost) */}
                <input
                  type="search"
                  placeholder="Search name…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ border: "1px solid #ddd", borderRadius: 6, padding: "6px 10px", minWidth: 240 }}
                  aria-label="Search student name"
                />
              </div>
            </div>
          </div>

          {/* Scrollable table container BELOW the toolbar */}
          <div style={containerStyle}>
            <div style={scrollerStyle}>
              <table style={tableStyle}>
                <thead style={theadStyle}>
                  <tr style={{ height: headerHeights.row1 }}>
                    {(() => {
                      const labels = ["Name", "Cohort", "Sem", "CU ID", "Matric No"];
                      return visibleMetaIdxs.map((idx, slot) => (
                        <th
                          key={`meta-r1-${idx}`}
                          rowSpan={2}
                          style={{ ...stickyThStyle(slot), verticalAlign: "middle" }}
                        >
                          {labels[idx]}
                        </th>
                      ));
                    })()}
                    {/* Course group headers (not sticky-left; only sticky-top via thStickyTopRow1) */}
                    {courseCodes.map((course) => {
                      const hide3 = hideAttempt3ByCourse.get(course) === true;
                      const span = hide3 ? 2 : 3;
                      return (
                        <th key={course} colSpan={span} style={thStickyTopRow1}>
                          <div style={{ fontWeight: 600 }}>{course}</div>
                        </th>
                      );
                    })}
                  </tr>

                  {/* Row 2: only attempt numbers under each course group */}
                  <tr style={{ height: headerHeights.row2 }}>
                    {courseCodes.flatMap((course) => {
                      const hide_3rd_col = hideAttempt3ByCourse.get(course) === true;
                      const attempts = hide_3rd_col ? [1, 2] : [1, 2, 3];
                      return attempts.map((attempt) => (
                        <th key={`${course}-a${attempt}`} style={{ ...thStickyTopRow2, minWidth: 64, maxWidth: 64 }}>
                          <span style={{ display: "inline-block", width: 20 }}>{attempt}</span>
                        </th>
                      ));
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((rec) => (
                    <tr key={rec.MATRIC_NO}>
                      {visibleMetaIdxs.map((idx, slot) => {
                        const raw =
                          idx === 0 ? rec.meta.STUDENT_NAME :
                          idx === 1 ? rec.meta.COHORT :
                          idx === 2 ? rec.meta.SEM :
                          idx === 3 ? rec.meta.CU_ID :
                                      rec.MATRIC_NO;
                        const content = idx === 0 ? highlight(raw) : raw;
                        return (
                          <td key={`meta-c-${idx}`} style={stickyTdStyle(slot)}>
                            {content}
                          </td>
                        );
                      })}
                      {courseCodes.flatMap((course) => {
                        const vals = rec.courses[course] ?? [null, null, null];
                        const hide_3rd_col = hideAttempt3ByCourse.get(course) === true;
                        const idxs = hide_3rd_col ? [0, 1] : [0, 1, 2];
                        return idxs.map((i) => (
                          <td key={`${course}-b${i}`} style={tdAttempt}>
                            {fmt(vals[i])}
                          </td>
                        ));
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {/* Upload modal */}
      {uploadOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setUploadOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
              width: "min(560px, 92vw)",
              padding: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Upload scores (.xlsm)</h3>
              <button
                onClick={() => setUploadOpen(false)}
                className="border px-2 py-1 rounded"
                aria-label="Close upload"
              >
                Close
              </button>
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
              <label htmlFor="xlsm-file" style={{ display: "block", marginBottom: 8 }}>
                Choose an .xlsm file:
              </label>
              <input
                id="xlsm-file"
                type="file"
                accept=".xlsm,application/vnd.ms-excel.sheet.macroEnabled.12"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                  setSelectedFile(f);
                  setUploadError("");
                }}
              />
              {selectedFile && (
                <div style={{ marginTop: 10, fontSize: 14 }}>
                  <div>Name: {selectedFile.name}</div>
                  <div>Size: {Math.ceil(selectedFile.size / 1024)} KB</div>
                  <div>Type: {selectedFile.type || "application/vnd.ms-excel.sheet.macroEnabled.12"}</div>
                </div>
              )}
              {uploadError && (
                <div style={{ marginTop: 10, color: "red" }}>{uploadError}</div>
              )}

              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  className="border px-3 py-1 rounded"
                  onClick={() => { setUploadOpen(false); setSelectedFile(null); setUploadError(""); }}
                >
                  Cancel
                </button>
                <button
                  className="border px-3 py-1 rounded"
                  onClick={handleUploadSubmit}
                  style={{ background: "#0d6efd", color: "white", borderColor: "#0d6efd" }}
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}   
    </div>
  );
}