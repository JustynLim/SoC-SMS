import React, { useState } from 'react';
import { MdOutlineEdit, MdOutlineSaveAs, MdOutlineCancel } from "react-icons/md";

export default function StudentScoresRow({ rec, courseCodes, hideAttempt3ByCourse, visibleMetaIdxs, stickyTdStyle, highlight, onUpdate, fmt, tdAttempt }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);

  const handleEdit = () => {
    setEditData(JSON.parse(JSON.stringify(rec))); // Deep copy for editing
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData(null);
  };

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
    setEditData(null);
  };

  const handleScoreChange = (courseCode, attemptIndex, value) => {
    setEditData(prev => {
      const newCourses = { ...prev.courses };
      if (!newCourses[courseCode]) {
        newCourses[courseCode] = [null, null, null];
      }
      newCourses[courseCode][attemptIndex] = value;
      return { ...prev, courses: newCourses };
    });
  };

  const handleFocus = (courseCode, attemptIndex, value) => {
    if (value === '-') {
      handleScoreChange(courseCode, attemptIndex, '');
    }
  };

  const handleBlur = (courseCode, attemptIndex, value) => {
    if (value === '') {
      handleScoreChange(courseCode, attemptIndex, '-');
    }
  };

  const currentRec = isEditing ? editData : rec;

  return (
    <tr key={currentRec.MATRIC_NO}>
      {visibleMetaIdxs.map((idx, slot) => {
        const raw =
          idx === 0 ? currentRec.meta.STUDENT_NAME :
          idx === 1 ? currentRec.meta.COHORT :
          idx === 2 ? currentRec.meta.SEM :
          idx === 3 ? currentRec.meta.CU_ID :
                      currentRec.MATRIC_NO;
        const content = idx === 0 ? highlight(raw) : raw;
        return (
          <td key={`meta-c-${idx}`} style={stickyTdStyle(slot)}>
            {content}
          </td>
        );
      })}
      {courseCodes.flatMap((course) => {
        const vals = currentRec.courses[course] ?? [null, null, null];
        const hide_3rd_col = hideAttempt3ByCourse.get(course) === true;
        const idxs = hide_3rd_col ? [0, 1] : [0, 1, 2];
        return idxs.map((i) => (
          <td key={`${course}-b${i}`} style={tdAttempt}>
            {isEditing ? (
              <input
                type="text"
                value={vals[i] ?? ""}
                onChange={(e) => handleScoreChange(course, i, e.target.value)}
                onFocus={() => handleFocus(course, i, vals[i])}
                onBlur={() => handleBlur(course, i, vals[i])}
                style={{ width: '100%', padding: '4px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            ) : (
              fmt(vals[i])
            )}
          </td>
        ));
      })}
      <td style={{...tdAttempt, position: 'sticky', right: 0, background: 'white', zIndex: 18, borderLeft: '2px solid #ddd'}}>
        {isEditing ? (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px"}}>
            <button onClick={handleSave} title="Save" style={{ padding: "4px 8px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}> <MdOutlineSaveAs size={18}/> </button>
            <button onClick={handleCancel} title="Cancel" style={{ padding: "4px 8px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}> <MdOutlineCancel size={18}/> </button>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px"}}>
            <button onClick={handleEdit} title="Edit Scores" style={{ padding: "4px 8px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}> <MdOutlineEdit size={18}/> </button>
          </div>
        )}
      </td>
    </tr>
  );
}
