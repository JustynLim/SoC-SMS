import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import StudentRow from "../components/StudentRow";
import useCohorts from "../components/useCohorts";
import useStudentsData from "../components/Students";
import "../App.css";

export default function StudentsPage() {
  const { data, loading, error } = useStudentsData();
  //const [students, setStudents] = useState([]);
  const {cohorts,loadingCohorts,errorCohorts} = useCohorts();
  const [students, setStudents] = React.useState(null);
  const [selectedCohort, setSelectedCohort] = React.useState("All");

  React.useLayoutEffect(() => {
    setStudents(Array.isArray(data) ? data : []);
  }, [data]);

  const filtered = React.useMemo(() => {
    if (selectedCohort === "All") return students;
    return students.filter(r => {
      const raw = r?.COHORT;
      if (!raw) return false;
      const d = new Date(raw);
      const y = Number.isFinite(d.getTime()) ? d.getFullYear() : Number(raw);
      return String(y) === selectedCohort;
    });
  }, [students, selectedCohort]);

  // React.useEffect(() => {
  //   if (data.length) setStudents(data);
  // }, [data]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (students === null) return <p>Loading...</p> // Still loading
  if (!students.length) return <p>No data found</p>; // Actually empty
  // //if (!data.length) return <p>No data found.</p>;

  // Mapping: DB column name -> Display name
  const columnMapping = {
    STUDENT_NAME: "Name",
    COHORT: "Cohort",
    SEM: "Sem",
    CU_ID: "CU ID",
    IC_NO: "IC No",
    MOBILE_NO: "Mobile No",
    EMAIL: "Email",
    BM: "BM",
    ENGLISH: "English",
    ENTRY_Q: "Entry Q",
    MATRIC_NO: "Matric No",
    STUDENT_STATUS: "Status"
  };

  // Fixed col order
  const columns = Object.keys(columnMapping);

  const normalizeDate = (dateValue) => {
    if (!dateValue) return null; 
    const d = new Date(dateValue); 
    if (isNaN(d)) return null; 
    return d.toISOString().split("T")[0]; // → "2022-04-22" 
  };

  const getCellValue = (row, colKey) => {
    if (row == null) return "-";

      // For all other columns
    let value;
    if (Object.prototype.hasOwnProperty.call(row, colKey)) {
        value = row[colKey];
    } else {
        const lowerKey = colKey.toLowerCase();
        for (const k of Object.keys(row)) {
            if (k.toLowerCase() === lowerKey) {
                value = row[k];
                break;
            }
        }
    }
  
    // // Explicitly check for null/undefined/empty string, but preserve 0
    // return value === null || value === undefined || value === "" ? "-" : value.toString();
    if (value === null || value === undefined || value === "") return "-";

    // Special case: COHORT (date → year)
    if (colKey === "COHORT") {
        try {
        return new Date(value).getFullYear();
        } catch {
        return "-";
        }
    }

    return value.toString();
    };

  // Center alignment for numeric fields
  const shouldCenter = (col) => 
    ['COHORT', 'SEM', 'CU_ID', 'BM', 'ENGLISH', 'MATRIC_NO',].includes(col);

  // --- API: Update student
  const updateStudent = async (student) => {
    const payload = { ...student };

    if (payload.COHORT) {
        payload.COHORT = normalizeDate(payload.COHORT);
    }

    try {
      const res = await fetch(`http://localhost:5001/api/students/${student.STUDENT_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Failed to update: ${res.status}`);
      const saved = await res.json();
      console.log(saved);

      // Update state
      setStudents((prev) =>
        prev.map((s) => (s.STUDENT_ID === student.STUDENT_ID ? { ...s, ...payload } : s))
      );
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update student");
    }
  };

  // --- API: Delete student
  const deleteStudent = async (studentId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/students/${studentId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(`Failed to delete student: ${res.status}`);

      // Update state
      setStudents((prev) => prev.filter((s) => s.STUDENT_ID !== studentId));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete student");
    }
  };

  // if (loading) return <p>Loading...</p>;
  // if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  // if (!students.length) return <p>No data found</p>;

  return (
    <div className="flex h-screen w-screen">
      <Sidebar />

      <div className="flex-1 p-8 w-full overflow-auto">
        {/* Column: toolbar on top, table below */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {/* Toolbar aligned to the right */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: 12,
              position: "sticky",
              top: 0,
              zIndex: 30,
              background: "white",
              paddingBottom: 1,
            }}
          >
            <label htmlFor="cohort">Cohort:</label>
            <select
              id="cohort"
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
            >
              <option value="All">All</option>
              {cohorts.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {loadingCohorts && <span>Loading cohorts…</span>}
            {errorCohorts && (
              <span style={{ color: "red" }}>Failed to load cohorts</span>
            )}
          </div>

          {/* Table container */}
          <div
            style={{
              margin: "20px auto",
              maxWidth: "95%",
              width: "fit-content",
            }}
          >
            <div
              style={{
                maxHeight: "calc(100vh - 150px)",
                overflow: "auto",
                position: "relative",
                border: "1px solid #ddd",
                borderRadius: "4px",
                margin: "0 auto",
                minWidth: "800px",
                maxWidth: "100%",
              }}
            >
              <table
                className="student-table"
                style={{
                  width: "100%",
                  tableLayout: "auto",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    {columns.map((col, colIndex) => {
                      const isLastCol = colIndex === columns.length - 1;
                      return (
                        <th
                          key={col}
                          style={{
                            position: "sticky",
                            top: 0,
                            background: "#f8f9fa",
                            zIndex: 10,
                            boxShadow: "0 2px 2px -1px rgba(0, 0, 0, 0.1)",
                            textAlign: "center",
                            padding: "8px 7px",
                            borderRight: isLastCol ? "none" : "1px solid #ddd",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {columnMapping[col]}
                        </th>
                      );
                    })}
                    <th
                      style={{
                        position: "sticky",
                        top: 0,
                        right: 0,
                        background: "#f8f9fa",
                        zIndex: 15,
                        boxShadow: "-2px 0 2px -1px rgba(0, 0, 0, 0.1)",
                        textAlign: "center",
                        padding: "8px 7px",
                        borderLeft: "1px solid #ddd",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <StudentRow
                      key={student.STUDENT_ID}
                      student={student}
                      columns={columns}
                      shouldCenter={shouldCenter}
                      onUpdate={updateStudent}
                      onDelete={(id) => deleteStudent(id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}