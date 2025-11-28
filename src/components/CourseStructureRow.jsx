import React, { useState } from 'react';
import { IconButton } from '@mui/material';
import { Edit, Delete, Save, Cancel } from '@mui/icons-material';

// A generic input component for the editable row
const EditableCell = ({ value, onChange, name, type = 'text', options = [] }) => {
  if (type === 'select') {
    return (
      <select name={name} value={value} onChange={onChange} className="w-full p-1 border rounded">
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  return (
    <input 
      type={type} 
      name={name} 
      value={value} 
      onChange={onChange} 
      className="w-full p-1 border rounded" 
    />
  );
};

const CourseStructureRow = ({ course, columns, columnMapping, onUpdate, onDelete, shouldCenter, getCellValue, lecturers }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCourse, setEditedCourse] = useState({ ...course });

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditedCourse(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    // First, check if any changes have been made
    if (JSON.stringify(course) === JSON.stringify(editedCourse)) {
      alert("No changes were made.");
      return; // Prevent API call
    }
    onUpdate(editedCourse);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedCourse({ ...course });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${course.COURSE_CODE}?`)) {
      onDelete(course.COURSE_CODE, course.PROGRAM_CODE);
    }
  };

  const getEditableField = (colKey) => {
    const value = editedCourse[colKey] || '';

    if (colKey === 'TOTAL_HR_WK') {
        const extractFirstNumber = (str) => {
            if (!str) return 0;
            const match = str.match(/^\d+/);
            return match ? parseInt(match[0], 10) : 0;
        };
      const lectHrs = extractFirstNumber(editedCourse.LECT_HR_WK) || 0;
      const tutHrs = extractFirstNumber(editedCourse.TUT_HR_WK) || 0;
      const labHrs = extractFirstNumber(editedCourse.LAB_HR_WK) || 0;
      const blHrs = extractFirstNumber(editedCourse.BL_HR_WK) || 0;
      return lectHrs + tutHrs + labHrs + blHrs;
    }

    if (colKey === 'LECTURER') {
      return <EditableCell name={colKey} value={value} onChange={handleEditChange} type="select" options={['- Unassigned -', ...lecturers]} />;
    }

    // Define dropdown options for specific fields
    if (colKey === 'COURSE_YEAR') {
      return <EditableCell name={colKey} value={value} onChange={handleEditChange} type="select" options={['Year 1', 'Year 2', 'Year 3', 'Compulsory']} />;
    }
    if (colKey === 'COURSE_STATUS') {
      return <EditableCell name={colKey} value={value} onChange={handleEditChange} type="select" options={['Active', 'Inactive']} />;
    }
    if (colKey === 'COURSE_LEVEL') {
        return <EditableCell name={colKey} value={value} onChange={handleEditChange} type="select" options={[1, 2, 3]} />;
    }
    if (colKey === 'COURSE_CLASSIFICATION') {
      return <EditableCell name={colKey} value={value} onChange={handleEditChange} type="select" options={['', 'Major', 'Minor']} />;
    }
    if (colKey === 'PRE_CO_REQ') {
      return <EditableCell name={colKey} value={value} onChange={handleEditChange} type="select" options={['', 'CS', 'CT', 'CS&CT']} />;
    }
    if (['CREDIT_HOUR', 'CU_CW_CREDITS', 'CU_EX_CREDITS'].includes(colKey)) {
      return <EditableCell name={colKey} value={value} onChange={handleEditChange} type="number" />;
    }

    // Make COURSE_CODE and PROGRAM_CODE non-editable
    if (['COURSE_CODE', 'PROGRAM_CODE'].includes(colKey)) {
        return course[colKey];
    }

    return <EditableCell name={colKey} value={value} onChange={handleEditChange} />;
  };

  return (
    <tr>
      {columns.map(colKey => (
        <td key={colKey} style={{ textAlign: shouldCenter(colKey) ? 'center' : 'left' }}>
          {isEditing ? getEditableField(colKey) : (getCellValue(course, colKey) ?? '-')}
        </td>
      ))}
      <td className="text-center">
        {isEditing ? (
          <div className="flex gap-2 justify-center">
            <IconButton onClick={handleSave} size="small" title="Save"><Save /></IconButton>
            <IconButton onClick={handleCancel} size="small" title="Cancel"><Cancel /></IconButton>
          </div>
        ) : (
          <div className="flex gap-2 justify-center">
            <IconButton onClick={() => setIsEditing(true)} size="small" title="Edit"><Edit /></IconButton>
            <IconButton onClick={handleDelete} size="small" title="Delete"><Delete /></IconButton>
          </div>
        )}
      </td>
    </tr>
  );
};

export default CourseStructureRow;
