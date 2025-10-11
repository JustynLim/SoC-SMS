import React from "react";

// Small helpers
const asArray = (v) => (Array.isArray(v) ? v : []);
const byText = (a, b) => String(a?.text ?? "").localeCompare(String(b?.text ?? ""), undefined, { sensitivity: "base" });

export default function GenerateList() {
  // List type: Internship/Mentorship
  const [listType, setListType] = React.useState("internship");

  // Internship filters (course/session)
  const [courseOptions, setCourseOptions] = React.useState([]);
  const [courseLoading, setCourseLoading] = React.useState(false);
  const [courseError, setCourseError] = React.useState("");
  const [selectedCourse, setSelectedCourse] = React.useState("");

  // Internship session options (from 3 attempt fields)
  const [internshipSessionOptions, setInternshipSessionOptions] = React.useState([]);
  const [internshipSessionLoading, setInternshipSessionLoading] = React.useState(false);
  const [internshipSessionError, setInternshipSessionError] = React.useState("");
  const [selectedInternshipSession, setSelectedInternshipSession] = React.useState("");
  
  // Mentorship session options (from 3 attempt fields)
  const [mentorshipSessionOptions, setMentorshipSessionOptions] = React.useState([]);
  const [mentorshipSessionLoading, setMentorshipSessionLoading] = React.useState(false);
  const [mentorshipSessionError, setMentorshipSessionError] = React.useState("");
  const [selectedMentorshipSession, setSelectedMentorshipSession] = React.useState("");


  // Preview data
  const [students, setStudents] = React.useState([]); // array of { STUDENT_NAME, MATRIC_NO, IC_NO, PHONE_NO, EMAIL }
  const [docLoading, setDocLoading] = React.useState(false);
  const [docError, setDocError] = React.useState("");

  const isInternship = listType === "internship";
  // Condition to display print button for generated list (into pdf)
  const hasPreview = students.length > 0;

 // Load course options only for internship flow
  React.useEffect(() => {
    let abort = false;
    if (!isInternship) return;

    (async () => {
      setCourseLoading(true);
      setCourseError("");
      try {
        const res = await fetch("http://localhost:5001/api/course-structure/options");
        if (!res.ok) throw new Error(`Failed to load courses: ${res.status}`);
        const json = await res.json();
        if (abort) return;
        const opts = asArray(json)
          .map((c) => ({
            value: String(c.code),
            text: `${c.code} - ${c.module} (${c.status})`,
          }))
          .sort(byText);
        setCourseOptions(opts);
      } catch (e) {
        if (!abort) setCourseError(e.message || "Failed to load courses");
      } finally {
        if (!abort) setCourseLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [isInternship]);

  // Load session options when course changes (internship only)
  React.useEffect(() => {
    // Clear preview when filters change
    setStudents([]);
    setDocError("");

    if (!isInternship) return;

    if (!selectedCourse) {
      setInternshipSessionOptions([]);
      setSelectedInternshipSession("");
      return;
    }
    let abort = false;
    (async () => {
      setInternshipSessionLoading(true);
      setInternshipSessionError("");
      try {
        const url = new URL("http://localhost:5001/api/student-score/sessions/internship");
        url.searchParams.set("courseCode", selectedCourse);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Failed to load sessions: ${res.status}`);
        const json = await res.json();
        if (abort) return;
        const opts = asArray(json)
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => ({ value: s, text: s }))
          .sort(byText);
        setInternshipSessionOptions(opts);
        setSelectedInternshipSession(opts[0]?.value || "");
      } catch (e) {
        if (!abort) setInternshipSessionError(e.message || "Failed to load sessions");
      } finally {
        if (!abort) setInternshipSessionLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [isInternship, selectedCourse]);

  // Fetch mentorship sessions when listType changes to mentorship
  React.useEffect(() => {
    if (listType !== "mentorship") return;
    let abort = false;
    (async () => {
      setMentorshipSessionLoading(true);
      setMentorshipSessionError("");
      try {
        const res = await fetch("http://localhost:5001/api/student-score/sessions/mentorship");
        if (!res.ok) throw new Error(`Failed to load mentorship sessions: ${res.status}`);
        const json = await res.json();
        if (abort) return;
        const opts = asArray(json)
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => ({ value: s, text: s }))
          .sort(byText);
        setMentorshipSessionOptions(opts);
        setSelectedMentorshipSession(opts[0]?.value || "");
      } catch (e) {
        if (!abort) setMentorshipSessionError(e.message || "Failed to load sessions");
      } finally {
        if (!abort) setMentorshipSessionLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [listType]);

  // Change handler for list type: reset preview and filters appropriately
  function onChangeListType(next) {
    setListType(next);
    setStudents([]);
    setDocError("");
    if (next === "internship") {
      // internship: keep current filters or reset
      setSelectedMentorshipSession("");
      setMentoshipSessionOptions([]);
    } else {
      // mentorship: hide course/session; clear them
      setSelectedCourse("");
      setSelectedInternshipSession("");
      setInternshipSessionOptions([]);
    }
  }

  async function onGenerate() {
    setDocError("");
    setDocLoading(true);
    try {
      if (isInternship) {
        const res = await fetch("http://localhost:5001/api/generate-list/internship", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseCode: selectedCourse,
            session: selectedInternshipSession,
          }),
        });
        if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
        const json = await res.json();
        setStudents(asArray(json.rows));
      } else {
        // mentorship
        const res = await fetch("http://localhost:5001/api/generate-list/mentorship", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: selectedMentorshipSession}), // pass selected session
        });
        if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
        const json = await res.json();
        setStudents(asArray(json.rows));
      }
    } catch (e) {
      setDocError(e.message || "Failed to generate list");
      setStudents([]);
    } finally {
      setDocLoading(false);
    }
  }

  async function downloadPdf() {
    try {
      if (isInternship) {
        const res = await fetch("http://localhost:5001/api/generate-list/internship/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseCode: selectedCourse, session: selectedInternshipSession }),
        });
        if (!res.ok) throw new Error(`Failed to generate PDF: ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `internship_list_${selectedCourse}_${selectedInternshipSession}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        // mentorship PDF
        const res = await fetch("http://localhost:5001/api/generate-list/mentorship/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: selectedMentorshipSession }), // pass selected session
        });
        if (!res.ok) throw new Error(`Failed to generate PDF: ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mentorship_list.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setDocError(e.message || "Failed to download PDF");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", rowGap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label>List type:</label>
          <select value={listType} onChange={(e) => onChangeListType(e.target.value)} style={{ minWidth: 200 }}>
            <option value="internship">Internship</option>
            <option value="mentorship">Mentorship</option>
          </select>
        </div>

        {isInternship ? (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label>Course:</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                style={{ minWidth: 360 }}
              >
                <option value="">{courseLoading ? "Loading..." : "Select a course"}</option>
                {courseOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.text}</option>
                ))}
              </select>
              {courseError && <span style={{ color: "red" }}>{courseError}</span>}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label>Session:</label>
              <select
                value={selectedInternshipSession}
                onChange={(e) => setSelectedInternshipSession(e.target.value)}
                style={{ minWidth: 160 }}
                disabled={!selectedCourse || internshipSessionLoading}
              >
                <option value="">{internshipSessionLoading ? "Loading..." : "Select a session"}</option>
                {internshipSessionOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.text}</option>
                ))}
              </select>
              {internshipSessionError && <span style={{ color: "red" }}>{internshipSessionError}</span>}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label>Session:</label>
            <select
              value={selectedMentorshipSession}
              onChange={(e) => setSelectedMentorshipSession(e.target.value)}
              style={{ minWidth: 160 }}
              disabled={mentorshipSessionLoading}
            >
              <option value="">{mentorshipSessionLoading ? "Loading..." : "Select a session"}</option>
              {mentorshipSessionOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.text}</option>
              ))}
            </select>
            {mentorshipSessionError && <span style={{ color: "red" }}>{mentorshipSessionError}</span>}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="border px-3 py-1 rounded"
            onClick={onGenerate}
            disabled={
              docLoading ||
              (isInternship && (!selectedCourse || !selectedInternshipSession)) ||
              (!isInternship && !selectedMentorshipSession)
            }
          >
            {docLoading ? "Generating..." : "Generate"}
          </button>

          {hasPreview && (
            <button className="border px-3 py-1 rounded" onClick={downloadPdf}>
              Download PDF
            </button>
          )}

          {docError && <span style={{ color: "red" }}>{docError}</span>}
        </div>
      </div>

      {/* HTML preview */}
      <div
        id="document-view"
        style={{
          background: "white",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>
          {isInternship
            ? `Internship List — ${selectedCourse || "Course"} — ${selectedInternshipSession || "Session"}`
            : "Mentorship List"}
        </h3>

        {!hasPreview ? (
          <div style={{ color: "#666" }}>Choose options and click Generate to preview the list.</div>
        ) : isInternship ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Matric No</th>
                <th style={thStyle}>IC No</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Email</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={`${s.MATRIC_NO || "-"}-${i}`}>
                  <td style={tdCenter}>{i + 1}</td>
                  <td style={tdLeft}>{s.STUDENT_NAME ?? "-"}</td>
                  <td style={tdLeft}>{s.MATRIC_NO ?? "-"}</td>
                  <td style={tdLeft}>{s.IC_NO ?? "-"}</td>
                  <td style={tdLeft}>{s.MOBILE_NO ?? s.PHONE_NO ?? "-"}</td>
                  <td style={tdLeft}>{s.EMAIL ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // Mentorship preview includes FAILED_COURSES
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Matric No</th>
                <th style={thStyle}>IC No</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Failed Courses</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={`${s.MATRIC_NO || "-"}-${i}`}>
                  <td style={tdCenter}>{i + 1}</td>
                  <td style={tdLeft}>{s.STUDENT_NAME ?? "-"}</td>
                  <td style={tdLeft}>{s.MATRIC_NO ?? "-"}</td>
                  <td style={tdLeft}>{s.IC_NO ?? "-"}</td>
                  <td style={tdLeft}>{s.MOBILE_NO ?? s.PHONE_NO ?? "-"}</td>
                  <td style={tdLeft}>{s.EMAIL ?? "-"}</td>
                  <td style={tdLeft}>{s.FAILED_COURSES ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "8px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};
const tdLeft = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid " + "#f4f4f4",
  whiteSpace: "nowrap",
};
const tdCenter = { ...tdLeft, textAlign: "center", width: 48 };
