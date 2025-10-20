import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import StudentRow from "../components/StudentRow";
import useCohorts from "../components/useCohorts";
import useStudentsData from "../components/Students";
import AddNewStudent from "../services/add_new_student";
import { BsPersonAdd } from "react-icons/bs";
import "../App.css";

// Helper functions for localStorage
const FILTER_STORAGE_KEY = 'studentsPageFilters';
const HIDDEN_COLS_KEY = 'studentsPageHiddenColumns';

const saveFiltersToStorage = (cohort, status) => {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ cohort, status }));
  } catch (e) {
    console.error('Failed to save filters:', e);
  }
};

const loadFiltersFromStorage = () => {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : { cohort: 'All', status: 'All' };
  } catch (e) {
    console.error('Failed to load filters:', e);
    return { cohort: 'All', status: 'All' };
  }
};

export default function StudentsPage() {
  const { data, loading, error, setData } = useStudentsData();
  //const [students, setStudents] = useState([]);
  const {cohorts,loadingCohorts,errorCohorts} = useCohorts();
  const [students, setStudents] = React.useState(null);
  
  // Initialise filters from localStorage
  const savedFilters = loadFiltersFromStorage();
  const [selectedCohort, setSelectedCohort] = React.useState(savedFilters.cohort);
  const [selectedStatus, setSelectedStatus] = React.useState(savedFilters.status);

  // Add new student (individually)
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Search functionality
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  // Debounce search query
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 180);
    return () => clearTimeout(id);
  }, [query]);

  // Column visibility
  const HIDABLE_COLUMNS = [
    { key: "MOBILE_NO", label: "Mobile No" },
    { key: "EMAIL", label: "Email" },
    { key: "BM", label: "BM" },
    { key: "ENGLISH", label: "English" },
    { key: "ENTRY_Q", label: "Entry Q" },
  ];

  const [hiddenColumns, setHiddenColumns] = React.useState(() => {
    const raw = localStorage.getItem(HIDDEN_COLS_KEY);
    try {
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleAddSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 3000);
    // Refresh student list
    fetch("http://localhost:5001/api/students")
      .then(res => res.json())
      .then(newData => setData(newData))
      .catch(err => console.error("Failed to refetch students:", err));
  };

  React.useEffect(() => {
    localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify(Array.from(hiddenColumns)));
  }, [hiddenColumns]);

  const toggleHidden = (key) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [colsMenuOpen, setColsMenuOpen] = React.useState(false);
  const [studentStatuses, setStudentStatuses] = React.useState([]);

  React.useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('http://localhost:5001/api/admin/student-statuses', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStudentStatuses(data);
        } else {
          console.error("Failed to fetch student statuses");
        }
      } catch (err) {
        console.error("Failed to fetch student statuses:", err);
      }
    };
    fetchStatuses();
  }, []);

  React.useLayoutEffect(() => {
    setStudents(Array.isArray(data) ? data : []);
  }, [data]);

  // Extract unique statuses from data
  const statuses = React.useMemo(() => {
    // Add safety check
    if (!students || !Array.isArray(students)) return [];

    const uniqueStatuses = [...new Set(students.map(s => s.STUDENT_STATUS).filter(Boolean))];
    return uniqueStatuses.sort();
  }, [students]);


  // Filter by both cohort and status
  const filtered = React.useMemo(() => {
    if (!students || !Array.isArray(students)) return [];

    let result = students;

    // Filter by cohort
    if (selectedCohort !== "All") {
      result = result.filter(r => {
        const raw = r?.COHORT;
        if (!raw) return false;
        const d = new Date(raw);
        const y = Number.isFinite(d.getTime()) ? d.getFullYear() : Number(raw);
        return String(y) === selectedCohort;
      });
    }

    // Filter by status
    if (selectedStatus !== "All") {
      result = result.filter(r => r?.STUDENT_STATUS === selectedStatus);
    }

    return result;
  }, [students, selectedCohort, selectedStatus]);

  // React.useEffect(() => {
  //   if (data.length) setStudents(data);
  // }, [data]);

  // Filter by search query
  const searchFiltered = React.useMemo(() => {
    if (!debouncedQuery) return filtered;
    return filtered.filter((student) => {
      const name = String(student?.STUDENT_NAME || "").toLowerCase();
      const matric = String(student?.MATRIC_NO || "").toLowerCase();
      return name.includes(debouncedQuery) || matric.includes(debouncedQuery);
    });
  }, [filtered, debouncedQuery]);

  // Highlight search matches
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

  // Save filters whenever they change
  React.useEffect(() => {
    saveFiltersToStorage(selectedCohort, selectedStatus);
  }, [selectedCohort, selectedStatus]);

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
    IC_NO: "IC/Passport No",
    MOBILE_NO: "Mobile No",
    EMAIL: "Email",
    BM: "BM",
    ENGLISH: "English",
    ENTRY_Q: "Entry Q",
    MATRIC_NO: "Matric No",
    STUDENT_STATUS: "Status"
  };

  // Get visible columns (filter out hidden ones)
  const visibleColumns = Object.keys(columnMapping).filter(
    (col) => !hiddenColumns.has(col)
  );

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
    ['COHORT', 'SEM', 'CU_ID', 'BM', 'ENGLISH', 'MATRIC_NO', 'STUDENT_STATUS'].includes(col);

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

  // Resets filters to default value
  const clearFilters = () => {
    setSelectedCohort('All');
    setSelectedStatus('All');
    setQuery('');
    saveFiltersToStorage('All', 'All');
  };

  // if (loading) return <p>Loading...</p>;
  // if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  // if (!students.length) return <p>No data found</p>;

return (
  <div className="flex h-screen w-screen">
    <Sidebar />

    <div className="flex-1 p-8 w-full overflow-auto">
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {/* Toolbar - Single Row */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            background: "white",
            paddingBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {/* Left side: Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label htmlFor="cohort" style={{ whiteSpace: "nowrap" }}>Cohort:</label>
            <select
              id="cohort"
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #ddd",
              }}
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
            
            <label htmlFor="status" style={{ whiteSpace: "nowrap" }}>Status:</label>
            <select
              id="status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #ddd",
              }}
            >
              <option value="All">All</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {(selectedCohort !== 'All' || selectedStatus !== 'All' || query) && (
              <button
                onClick={clearFilters}
                style={{
                  padding: "4px 12px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  background: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: "13px",
                  whiteSpace: "nowrap",
                }}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Right side: Columns & Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              position: "relative",
            }}
          >
            {/* Columns button */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setColsMenuOpen((v) => !v)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                title="Show/Hide columns"
              >
                Columns
              </button>

              {colsMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    marginTop: 6,
                    background: "white",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                    padding: 12,
                    minWidth: 180,
                    zIndex: 310,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '14px' }}>
                    Show/Hide Columns
                  </div>
                  {HIDABLE_COLUMNS.map(({ key, label }) => (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 2px",
                        cursor: "pointer",
                        fontSize: '13px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.has(key)}
                        onChange={() => toggleHidden(key)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
                    <button
                      onClick={() => setColsMenuOpen(false)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                        fontSize: '13px',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setAddStudentOpen(true)}
              style={{
                padding: "8px",
                background: "#1e88e5",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Add new student"
            >
              <BsPersonAdd size={20} />
            </button>

            {/* // At the bottom of your component: */}
            <AddNewStudent
              isOpen={addStudentOpen}
              onClose={() => setAddStudentOpen(false)}
              onSuccess={handleAddSuccess}
            />

            {successMessage && (
              <div style={{
                position: "fixed",
                top: 20,
                right: 20,
                padding: 12,
                background: "#28a745",
                color: "white",
                borderRadius: 4,
                zIndex: 2000,
              }}>
                {successMessage}
              </div>
            )}

            {/* Search */}
            <input
              type="search"
              placeholder="Search name or matric no…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                border: "1px solid #ddd",
                borderRadius: 6,
                padding: "6px 10px",
                minWidth: 240,
              }}
            />
          </div>
        </div>

        {/* Table container */}
        <div
          style={{
            margin: "20px auto",
            maxWidth: "100%",
            width: "fit-content",
          }}
        >
          <div
            style={{
              maxHeight: "calc(100vh - 200px)",
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
                  {visibleColumns.map((col, colIndex) => {
                    const isLastCol = colIndex === visibleColumns.length - 1;
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
                          padding: "8px 10px",
                          borderRight: "1px solid #ddd", // Always show border
                          borderBottom: "1px solid #ddd", // Add bottom border
                          //borderRight: isLastCol ? "none" : "1px solid #ddd",
                          whiteSpace: "nowrap",
                          // Add extra padding for last visible column
                          paddingRight: isLastCol ? "24px" : "10px",
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
                      padding: "8px 10px",
                      borderLeft: "2px solid #ddd", // Thicker left border for separation
                      borderBottom: "1px solid #ddd", // Add bottom border
                      //borderLeft: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {searchFiltered.map((student) => (
                  <StudentRow
                    key={student.STUDENT_ID}
                    student={student}
                    columns={visibleColumns}
                    shouldCenter={shouldCenter}
                    onUpdate={updateStudent}
                    onDelete={(id) => deleteStudent(id)}
                    highlight={highlight}
                    studentStatuses={studentStatuses}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Filter Summary - Moved to bottom right after table */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <span style={{ color: "#666", fontSize: "14px" }}>
              Showing {searchFiltered.length} of {students.length} students
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);




  // return (
  //   <div className="flex h-screen w-screen">
  //     <Sidebar />

  //     <div className="flex-1 p-8 w-full overflow-auto">
  //       <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
  //         {/* Toolbar */}
  //         <div
  //           style={{
  //             position: "sticky",
  //             top: 0,
  //             zIndex: 30,
  //             background: "white",
  //             paddingBottom: 4,
  //           }}
  //         >
  //           {/* Grid container with two rows */}
  //           <div
  //             style={{
  //               display: "grid",
  //               gridTemplateColumns: "1fr 1fr",
  //               gridTemplateAreas: `
  //                 "filters  filters"
  //                 ".        actions"
  //               `,
  //               rowGap: 8,
  //               columnGap: 12,
  //               alignItems: "center",
  //             }}
  //           >
  //             {/* Row 1: Filters (Cohort, Status) spanning both columns */}
  //             <div style={{ gridArea: "filters", display: "flex", alignItems: "center", gap: 12 }}>
  //               <label htmlFor="cohort">Cohort:</label>
  //               <select
  //                 id="cohort"
  //                 value={selectedCohort}
  //                 onChange={(e) => setSelectedCohort(e.target.value)}
  //                 style={{
  //                   padding: "4px 8px",
  //                   borderRadius: "4px",
  //                   border: "1px solid #ddd",
  //                 }}
  //               >
  //                 <option value="All">All</option>
  //                 {cohorts.map((y) => (
  //                   <option key={y} value={y}>
  //                     {y}
  //                   </option>
  //                 ))}
  //               </select>
  //               {loadingCohorts && <span>Loading cohorts…</span>}
  //               {errorCohorts && (
  //                 <span style={{ color: "red" }}>Failed to load cohorts</span>
  //               )}
                
  //               <label htmlFor="status">Status:</label>
  //               <select
  //                 id="status"
  //                 value={selectedStatus}
  //                 onChange={(e) => setSelectedStatus(e.target.value)}
  //                 style={{
  //                   padding: "4px 8px",
  //                   borderRadius: "4px",
  //                   border: "1px solid #ddd",
  //                 }}
  //               >
  //                 <option value="All">All</option>
  //                 {statuses.map((status) => (
  //                   <option key={status} value={status}>
  //                     {status}
  //                   </option>
  //                 ))}
  //               </select>

  //               {(selectedCohort !== 'All' || selectedStatus !== 'All' || query) && (
  //                 <button
  //                   onClick={clearFilters}
  //                   style={{
  //                     padding: "4px 12px",
  //                     borderRadius: "4px",
  //                     border: "1px solid #ddd",
  //                     background: "#f5f5f5",
  //                     cursor: "pointer",
  //                     fontSize: "13px",
  //                   }}
  //                 >
  //                   Clear All
  //                 </button>
  //               )}
  //             </div>

  //             {/* Row 2: Actions (Columns button, Search) aligned to the right */}
  //             <div
  //               style={{
  //                 gridArea: "actions",
  //                 display: "flex",
  //                 justifyContent: "flex-end",
  //                 alignItems: "center",
  //                 gap: 10,
  //                 position: "relative",
  //               }}
  //             >
  //               {/* Columns button */}
  //               <div style={{ position: "relative" }}>
  //                 <button
  //                   onClick={() => setColsMenuOpen((v) => !v)}
  //                   style={{
  //                     padding: "4px 12px",
  //                     borderRadius: "4px",
  //                     border: "1px solid #ddd",
  //                     background: "white",
  //                     cursor: "pointer",
  //                   }}
  //                   title="Show/Hide columns"
  //                 >
  //                   Columns
  //                 </button>

  //                 {colsMenuOpen && (
  //                   <div
  //                     style={{
  //                       position: "absolute",
  //                       right: 0,
  //                       marginTop: 6,
  //                       background: "white",
  //                       border: "1px solid #ddd",
  //                       borderRadius: 6,
  //                       boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
  //                       padding: 12,
  //                       minWidth: 180,
  //                       zIndex: 310,
  //                     }}
  //                   >
  //                     <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '14px' }}>
  //                       Show/Hide Columns
  //                     </div>
  //                     {HIDABLE_COLUMNS.map(({ key, label }) => (
  //                       <label
  //                         key={key}
  //                         style={{
  //                           display: "flex",
  //                           alignItems: "center",
  //                           gap: 8,
  //                           padding: "4px 2px",
  //                           cursor: "pointer",
  //                           fontSize: '13px',
  //                         }}
  //                       >
  //                         <input
  //                           type="checkbox"
  //                           checked={!hiddenColumns.has(key)}
  //                           onChange={() => toggleHidden(key)}
  //                         />
  //                         <span>{label}</span>
  //                       </label>
  //                     ))}
  //                     <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
  //                       <button
  //                         onClick={() => setColsMenuOpen(false)}
  //                         style={{
  //                           padding: "4px 12px",
  //                           borderRadius: "4px",
  //                           border: "1px solid #ddd",
  //                           background: "white",
  //                           cursor: "pointer",
  //                           fontSize: '13px',
  //                         }}
  //                       >
  //                         Close
  //                       </button>
  //                     </div>
  //                   </div>
  //                 )}
  //               </div>

  //               {/* Search */}
  //               <input
  //                 type="search"
  //                 placeholder="Search name or matric no…"
  //                 value={query}
  //                 onChange={(e) => setQuery(e.target.value)}
  //                 style={{
  //                   border: "1px solid #ddd",
  //                   borderRadius: 6,
  //                   padding: "6px 10px",
  //                   minWidth: 240,
  //                 }}
  //               />
  //             </div>
  //           </div>

  //           {/* Filter Summary */}
  //           <div style={{ marginTop: 8, color: "#666", fontSize: "14px" }}>
  //             Showing {searchFiltered.length} of {students.length} students
  //           </div>
  //         </div>

  //         {/* Table container */}
  //         <div
  //           style={{
  //             margin: "20px auto",
  //             maxWidth: "95%",
  //             width: "fit-content",
  //           }}
  //         >
  //           <div
  //             style={{
  //               maxHeight: "calc(100vh - 200px)",
  //               overflow: "auto",
  //               position: "relative",
  //               border: "1px solid #ddd",
  //               borderRadius: "4px",
  //               margin: "0 auto",
  //               minWidth: "800px",
  //               maxWidth: "100%",
  //             }}
  //           >
  //             <table
  //               className="student-table"
  //               style={{
  //                 width: "100%",
  //                 tableLayout: "auto",
  //                 borderCollapse: "collapse",
  //               }}
  //             >
  //               <thead>
  //                 <tr>
  //                   {visibleColumns.map((col, colIndex) => {
  //                     const isLastCol = colIndex === visibleColumns.length - 1;
  //                     return (
  //                       <th
  //                         key={col}
  //                         style={{
  //                           position: "sticky",
  //                           top: 0,
  //                           background: "#f8f9fa",
  //                           zIndex: 10,
  //                           boxShadow: "0 2px 2px -1px rgba(0, 0, 0, 0.1)",
  //                           textAlign: "center",
  //                           padding: "8px 7px",
  //                           borderRight: isLastCol ? "none" : "1px solid #ddd",
  //                           whiteSpace: "nowrap",
  //                         }}
  //                       >
  //                         {columnMapping[col]}
  //                       </th>
  //                     );
  //                   })}
  //                   <th
  //                     style={{
  //                       position: "sticky",
  //                       top: 0,
  //                       right: 0,
  //                       background: "#f8f9fa",
  //                       zIndex: 15,
  //                       boxShadow: "-2px 0 2px -1px rgba(0, 0, 0, 0.1)",
  //                       textAlign: "center",
  //                       padding: "8px 7px",
  //                       borderLeft: "1px solid #ddd",
  //                       whiteSpace: "nowrap",
  //                     }}
  //                   >
  //                     Actions
  //                   </th>
  //                 </tr>
  //               </thead>
  //               <tbody>
  //                 {searchFiltered.map((student) => (
  //                   <StudentRow
  //                     key={student.STUDENT_ID}
  //                     student={student}
  //                     columns={visibleColumns}
  //                     shouldCenter={shouldCenter}
  //                     onUpdate={updateStudent}
  //                     onDelete={(id) => deleteStudent(id)}
  //                     highlight={highlight}
  //                   />
  //                 ))}
  //               </tbody>
  //             </table>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   </div>
  // );
}