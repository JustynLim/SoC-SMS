import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdDeleteOutline, MdOutlineEdit, MdOutlineCancel, MdOutlineSaveAs } from "react-icons/md";


// This component is solely for the action col to edit and delete student records

export default function StudentRow({ student, columns, shouldCenter, onUpdate, onDelete, highlight }) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ ...student });
  const navigate = useNavigate();

  const handleChange = (e, col) => {
    setFormData({
      ...formData,
      [col]: e.target.value === "" ? null : e.target.value,
    });
  };

  const handleSave = () => {
    onUpdate(formData);
    setEditMode(false);
  };

  const handleCancel = () => {
    setFormData({ ...student }); // reset to original
    setEditMode(false);
  };

  const handleNameClick = () => {
    navigate(`/students-info/${student.MATRIC_NO}`);
  };

  return (
    <tr>
      {columns.map((col, colIndex) => {
        const value = formData[col] ?? "-";
        const isLastCol = colIndex === columns.length - 1;
        const isNameColumn = col === "STUDENT_NAME";
        
        // Apply highlight to name if search is active
        const displayValue = isNameColumn && highlight && !editMode
          ? highlight(value)
          : col === "COHORT" && value !== "-" && !editMode
          ? new Date(value).getFullYear()
          : value;
        
        return (
          <td
            key={col}
            style={{
              textAlign: value === "-" ? "center" : shouldCenter(col) ? "center" : "left",
              padding: "8px 10px",
              borderRight: "1px solid #eee", // Always show border
              borderBottom: "1px solid #eee", // Add consistent bottom border              
              //borderRight: isLastCol ? "none" : "1px solid #ddd",
              whiteSpace: "nowrap",
              cursor: isNameColumn && !editMode ? "pointer" : "default",
              color: isNameColumn && !editMode ? "#007bff" : "inherit",
              // Add extra padding for last visible column
              paddingRight: isLastCol ? "24px" : "10px",
            }}
            onClick={isNameColumn && !editMode ? handleNameClick : undefined}
            onMouseEnter={(e) => {
              if (isNameColumn && !editMode) {
                e.target.style.textDecoration = "underline";
              }
            }}
            onMouseLeave={(e) => {
              if (isNameColumn && !editMode) {
                e.target.style.textDecoration = "none";
              }
            }}
          >
            {editMode ? (
              col === "COHORT" ? (
                // Show full date in edit mode
                <input
                  type="date"
                  value={value && value !== "-" ? new Date(value).toISOString().split("T")[0] : ""}
                  onChange={(e) => handleChange(e, col)}
                  style={{ width: "100%", padding: "4px" }}
                />
              ) : (
                <input
                  value={value !== "-" ? value : ""}
                  onChange={(e) => handleChange(e, col)}
                  style={{ width: "100%", padding: "4px" }}
                />
              )
            ) : (
              displayValue
            )}
          </td>
        );
      })}

      {/* Actions buttons */}
      <td
        style={{
          position: "sticky",
          right: 0,
          background: "#fff",
          zIndex: 5,
          textAlign: "center",
          padding: "8px 10px",
          borderLeft: "2px solid #ddd", // Thicker left border to match header
          borderBottom: "1px solid #eee", // Add bottom border
          //borderLeft: "1px solid #ddd",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: "8px"}}>
            {editMode ? (
            <>
                <button
                onClick={handleSave}
                style={{
                    marginRight: "6px",
                    padding: "4px 8px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                }}
                >
                <MdOutlineSaveAs size={18}/>
                </button>
                <button
                onClick={handleCancel}
                style={{
                    padding: "4px 8px",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                }}
                >
                <MdOutlineCancel size={18}/>
                </button>
            </>
            ) : (
            <>
                <button
                onClick={() => setEditMode(true)}
                style={{
                    marginRight: "6px",
                    padding: "4px 8px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                }}
                >
                <MdOutlineEdit size={18}/>
                </button>

                <button
                onClick={() => {
                    const confirmDelete = window.confirm(
                    "⚠️ Warning: Deleting this student will also remove all their grades.\n\nAre you sure you want to continue?"
                    );
                    if (confirmDelete) {
                    onDelete(student.STUDENT_ID); // pass ID to StudentsPage
                    }
                }}
                style={{
                    padding: "4px 8px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                }}
                >
                <MdDeleteOutline size={18} />
                </button>
            </>
            )}
        </div>
      </td>
    </tr>
  );
}
