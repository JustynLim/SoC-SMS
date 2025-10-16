import React, { useState, useEffect } from "react";
import { MdClose } from "react-icons/md";

export default function AddNewStudent({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    STUDENT_NAME: "",
    COHORT: "",
    SEM: "",
    CU_ID: "",
    IC_NO: "",
    MOBILE_NO: "",
    EMAIL: "",
    BM: "",
    ENGLISH: "",
    ENTRY_Q: "",
    MATRIC_NO: "",
    COURSE_VERSION: "",
  });

  const [courseVersions, setCourseVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch available course versions
  useEffect(() => {
    if (isOpen) {
      fetch("http://localhost:5001/api/course-versions")
        .then((res) => res.json())
        .then((data) => setCourseVersions(data.versions || []))
        .catch((err) => console.error("Failed to fetch course versions:", err));
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Normalize COHORT to YYYY-MM-DD
    if (name === "COHORT") {
      // If user agent ever returns dd-mm-yyyy, normalize
      // Detect dd-mm-yyyy by regex:
      const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
      if (ddmmyyyy.test(value)) {
        const [, dd, mm, yyyy] = value.match(ddmmyyyy);
        const iso = `${yyyy}-${mm}-${dd}`;
        setFormData((f) => ({ ...f, COHORT: iso }));
        return;
      }
    }
    setFormData((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const requiredFields = ["STUDENT_NAME", "COHORT", "SEM", "CU_ID", "IC_NO", "MATRIC_NO", "COURSE_VERSION"];
    for (const field of requiredFields) {
      const v = (formData[field] ?? "").toString().trim();
      if (!v) {
        setError(`${field.replace("_", " ")} is required`);
        return;
      }
    }

    // Extra client-side checks
    let cohort = (formData.COHORT || "").trim();
    // Ensure date is strictly YYYY-MM-DD (HTML date input uses this)
    // Accept dd-mm-yyyy and convert to ISO if user agent/localization produced that
    const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
    if (ddmmyyyy.test(cohort)) {
      const [, dd, mm, yyyy] = cohort.match(ddmmyyyy);
      cohort = `${yyyy}-${mm}-${dd}`;
    }

    // Final check must be ISO
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cohort)) {
      setError("COHORT must be a valid date (YYYY-MM-DD)");
      return;
    }

    // Ensure CU_ID contains only digits (backend coerces to int)
    const cu = formData.CU_ID.toString().trim();
    if (!/^\d+$/.test(cu)) {
      setError("CU ID must be numeric");
      return;
    }

    // 4) SEM is varchar(2) in DB; keep as trimmed string (from number input)
    const semStr = (formData.SEM ?? "").toString().trim();
    if (!semStr) {
      setError("SEM is required");
      return;
    }

    // Normalize payload to expected backend types/format
    const payload = {
      STUDENT_NAME: formData.STUDENT_NAME.toString().trim(),
      COHORT: cohort,                 // keep as 'YYYY-MM-DD'
      SEM: semStr,  // varchar(2) in DB
      CU_ID: cu,                      // backend will int() this
      IC_NO: formData.IC_NO.toString().trim(),
      MOBILE_NO: (formData.MOBILE_NO ?? "").toString().trim(),
      EMAIL: (formData.EMAIL ?? "").toString().trim(),
      BM: (formData.BM ?? "").toString().trim(),
      ENGLISH: (formData.ENGLISH ?? "").toString().trim(),
      ENTRY_Q: (formData.ENTRY_Q ?? "").toString().trim(),
      MATRIC_NO: formData.MATRIC_NO.toString().trim(),
      COURSE_VERSION: formData.COURSE_VERSION.toString().trim(),
    };

    setLoading(true);
    try {
      const res = await fetch("http://localhost:5001/api/add-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { error: text }; }

      if (!res.ok) {
        throw new Error(json.error || `Failed to add student (${res.status})`);
      }

      onSuccess(json.message || "Student added successfully");
      onClose();
      
      // Reset form
      setFormData({
        STUDENT_NAME: "",
        COHORT: "",
        SEM: "",
        CU_ID: "",
        IC_NO: "",
        MOBILE_NO: "",
        EMAIL: "",
        BM: "",
        ENGLISH: "",
        ENTRY_Q: "",
        MATRIC_NO: "",
        COURSE_VERSION: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 8,
          boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
          width: "min(600px, 95vw)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Add New Student</h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <MdClose size={24} />
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, background: "#fee", color: "#c00", borderRadius: 4, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Name - Full width */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
                Name <span style={{ color: "red" }}>*</span>
              </label>
              <input
                name="STUDENT_NAME"
                value={formData.STUDENT_NAME}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            {/* Matric No */}
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
                Matric No <span style={{ color: "red" }}>*</span>
              </label>
              <input
                name="MATRIC_NO"
                value={formData.MATRIC_NO}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            {/* CU ID */}
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
                CU ID <span style={{ color: "red" }}>*</span>
              </label>
              <input
                name="CU_ID"
                type="number"
                value={formData.CU_ID}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            {/* IC No */}
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
                IC/Passport No <span style={{ color: "red" }}>*</span>
              </label>
              <input
                name="IC_NO"
                value={formData.IC_NO}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            {/* Cohort */}
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
                Cohort <span style={{ color: "red" }}>*</span>
              </label>
              <input
                name="COHORT"
                type="date"
                value={formData.COHORT}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            {/* Semester */}
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
                Semester <span style={{ color: "red" }}>*</span>
              </label>
              <input
                name="SEM"
                type="number"
                min="1"
                value={formData.SEM}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            {/* Course Version */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
                Course Version <span style={{ color: "red" }}>*</span>
              </label>
              <select
                name="COURSE_VERSION"
                value={formData.COURSE_VERSION}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              >
                <option value="">-- Select Course Version --</option>
                {courseVersions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Fields */}
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Mobile No</label>
              <input
                name="MOBILE_NO"
                value={formData.MOBILE_NO}
                onChange={handleChange}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Email</label>
              <input
                name="EMAIL"
                type="email"
                value={formData.EMAIL}
                onChange={handleChange}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>BM</label>
              <input
                name="BM"
                value={formData.BM}
                onChange={handleChange}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>English</label>
              <input
                name="ENGLISH"
                value={formData.ENGLISH}
                onChange={handleChange}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Entry-Q</label>
              <input
                name="ENTRY_Q"
                value={formData.ENTRY_Q}
                onChange={handleChange}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                border: "1px solid #ddd",
                borderRadius: 4,
                background: "white",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: 4,
                background: loading ? "#ccc" : "#007bff",
                color: "white",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Adding..." : "Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
