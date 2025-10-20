import React, { useState, useCallback } from "react";
import Course_Structure from "../components/CourseStructure";
import AddCourseModal from "../components/AddCourseModal";
import CourseStructureRow from "../components/CourseStructureRow"; // Import the new row component
import api from "../services/api"; // Import the api service
import '../App.css'
import Sidebar from "../components/Sidebar"


export default function CourseStructurePage() {
  const { data, loading, error, setData } = Course_Structure();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const refetchCourses = useCallback(() => {
    fetch("http://localhost:5001/api/course-structure")
      .then(res => res.json())
      .then(newData => setData(newData))
      .catch(err => console.error("Refetch failed:", err));
  }, [setData]);

  const handleUpdateCourse = async (updatedCourse) => {
    try {
      await api.put('/course-structure', {
        ...updatedCourse,
        original_course_code: updatedCourse.COURSE_CODE, // Assuming code is not editable
        original_program_code: updatedCourse.PROGRAM_CODE,
      });
      // Refresh data to show updated course
      refetchCourses();
    } catch (err) {
      console.error("Failed to update course:", err);
      alert("Update failed! " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteCourse = async (courseCode, programCode) => {
    try {
      await api.delete(`/course-structure/${courseCode}/${programCode}`);
      // Remove course from local state
      setData(prevData => prevData.filter(c => !(c.COURSE_CODE === courseCode && c.PROGRAM_CODE === programCode)));
    } catch (err) {
      console.error("Failed to delete course:", err);
      alert("Delete failed! " + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (!data.length) return <p>No data found.</p>;

  const coursesByYear = data.reduce((acc, course) => {
    const year = course.COURSE_YEAR || 'Uncategorized';
    if (!acc[year]) acc[year] = [];
    acc[year].push(course);
    return acc;
  }, {});

  const yearOrder = ['Year 1', 'Year 2', 'Year 3', 'Compulsory'];

  const sortedYears = Object.keys(coursesByYear).sort((a, b) => {
    const aIndex = yearOrder.indexOf(a);
    const bIndex = yearOrder.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  const columnMapping = {
    COURSE_CODE: "Code",
    PROGRAM_CODE: "Program",
    MODULE: "Module",
    COURSE_CLASSIFICATION: "Classification",
    PRE_CO_REQ: "Pre/Co Req",
    CREDIT_HOUR: "Credit Hour",
    LECT_HR_WK: "Lect hr/wk",
    TUT_HR_WK: "Tut hr/wk",
    LAB_HR_WK: "Lab hr/wk",
    BL_HR_WK: "BL hr/wk",
    TOTAL_HR_WK: "Total hr/wk",
    CU_CW_CREDITS: "CU-CW Credits",
    CU_EX_CREDITS: "CU-EX Credits",
    COURSE_LEVEL: "Level",
    LECTURER: "Lecturer",
    COURSE_STATUS: "Course Status"
  };

  const columns = Object.keys(columnMapping);

  const getCellValue = (row, colKey) => {
    if (row == null) return "-";
    
    if (colKey === 'TOTAL_HR_WK') {
        const extractFirstNumber = (str) => {
            if (!str) return 0;
            const match = str.match(/^\d+/);
            return match ? parseInt(match[0], 10) : 0;
        };
      const lectHrs = extractFirstNumber(row.LECT_HR_WK) || 0;
      const tutHrs = extractFirstNumber(row.TUT_HR_WK) || 0;
      const labHrs = extractFirstNumber(row.LAB_HR_WK) || 0;
      const blHrs = extractFirstNumber(row.BL_HR_WK) || 0;
      const total = lectHrs + tutHrs + labHrs + blHrs;
      return total === 0 ? "0" : total.toString();
    }

    let value = row[colKey];
    return value === null || value === undefined || value === "" ? "-" : value.toString();
  };

  const shouldCenter = (col) => [
    'PROGRAM_CODE',
    'COURSE_CLASSIFICATION',
    'PRE_CO_REQ',
    'CREDIT_HOUR',
    'LECT_HR_WK',
    'TUT_HR_WK',
    'LAB_HR_WK',
    'BL_HR_WK',
    'TOTAL_HR_WK',
    'CU_CW_CREDITS',
    'CU_EX_CREDITS',
    'COURSE_LEVEL',
    'COURSE_STATUS'
  ].includes(col);

  return (
  <div className = "flex h-screen w-screen">
    <Sidebar />

  <div className="flex-1 p-8 w-full overflow-auto">
      <AddCourseModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCourseAdded={refetchCourses}
      />
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 bg-blue-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        title="Add new course"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

        <div style={{ 
          margin: '20px auto', 
          maxWidth: '95%', 
          width: 'fit-content' 
        }}>
          <div style={{
            maxHeight: 'calc(100vh - 150px)',
            overflowY: 'auto',
            position: 'relative',
            border: '1px solid #ddd',
            borderRadius: '4px',
            margin: '0 auto', 
            minWidth: '800px', 
            maxWidth: 'calc(100vw - 100px)' 
          }}>
            <table className="course-table" style={{
              width: '100%', 
              minWidth: '900px' 
            }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th 
                      key={col} 
                      style={{
                        position: 'sticky',
                        top: 0,
                        background: '#f8f9fa',
                        zIndex: 10,
                        boxShadow: '0 2px 2px -1px rgba(0, 0, 0, 0.1)',
                        textAlign: 'center'
                      }}
                    >
                      {columnMapping[col]}
                    </th>
                  ))}
                  <th style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 10, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedYears.map((year) => (
                  <React.Fragment key={`year-${year}`}>
                    <tr style={{
                      backgroundColor: '#e9ecef',
                      position: 'sticky',
                      top: '40px',
                      zIndex: 5
                    }}>
                      <td colSpan={columns.length + 1} style={{
                        fontWeight: 'bold',
                        padding: '8px',
                        fontSize: '1.1em'
                      }}>
                        {year}
                      </td>
                    </tr>
                    {coursesByYear[year].map((course, index) => (
                      <CourseStructureRow
                        key={`${course.COURSE_CODE}-${course.PROGRAM_CODE}`}
                        course={course}
                        columns={columns}
                        columnMapping={columnMapping}
                        shouldCenter={shouldCenter}
                        onUpdate={handleUpdateCourse}
                        onDelete={handleDeleteCourse}
                        getCellValue={getCellValue}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
);
}