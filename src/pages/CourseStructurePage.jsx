import React from "react";
import Course_Structure from "../components/CourseStructure";
import '../App.css'
import Sidebar from "../components/Sidebar"


export default function CourseStructurePage() {
  const { data, loading, error } = Course_Structure();

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (!data.length) return <p>No data found.</p>;

  // Group courses by year
  const coursesByYear = data.reduce((acc, course) => {
    const year = course.COURSE_YEAR || 'Uncategorized';
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(course);
    return acc;
  }, {});

  // Define the desired year order
  const yearOrder = ['Year 1', 'Year 2', 'Year 3', 'Compulsory'];

  // Sort the years according to desired order
  const sortedYears = Object.keys(coursesByYear).sort((a, b) => {
    const aIndex = yearOrder.indexOf(a);
    const bIndex = yearOrder.indexOf(b);
    
    // If both are in ordered list, sort by their position
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    // If only one is in the ordered list, that comes first
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    // Otherwise sort alphabetically
    return a.localeCompare(b);
  });

  // Mapping: DB column name -> Display name
  const columnMapping = {
    COURSE_CODE: "Code",
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

  // Fixed col order
  const columns = Object.keys(columnMapping);

  const getCellValue = (row, colKey) => {
    if (row == null) return "-";
    
    // Handles calc for Total hr/wk column
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
  
    // Explicitly check for null/undefined/empty string, but preserve 0
    return value === null || value === undefined || value === "" ? "-" : value.toString();
    };

  // Center alignment for numeric fields
  const shouldCenter = (col) => [
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
    {/* <h1 className="text-3xl font-bold mb-4">Course Structure</h1> */}
        <div style={{ 
          margin: '20px auto', // Centered with auto margins
          maxWidth: '95%', // Prevents table from touching screen edges
          width: 'fit-content' // Container fits table width
        }}>
          {/* <h1>Course Structure</h1> */}
          <div style={{
            maxHeight: 'calc(100vh - 150px)',
            overflowY: 'auto',
            position: 'relative',
            border: '1px solid #ddd',
            borderRadius: '4px',
            margin: '0 auto', // Center the scrollable container
            minWidth: '800px', // Minimum width before scrolling
            maxWidth: 'calc(100vw - 100px)' // Maximum width with side margins
          }}>
            <table className="course-table" style={{
              width: '100%', // Table fills its container
              minWidth: '900px' // Ensure all columns are visible
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
                      <td colSpan={columns.length} style={{
                        fontWeight: 'bold',
                        padding: '8px',
                        fontSize: '1.1em'
                      }}>
                        {year}
                      </td>
                    </tr>
                    {coursesByYear[year].map((course, index) => (
                      <tr key={`${year}-${index}`}>
                        {columns.map((col) => (
                          <td 
                            key={col}
                            style={{ 
                              textAlign: shouldCenter(col) ? 'center' : 'left',
                              backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                            }}
                          >
                            {getCellValue(course, col) || '-'}
                          </td>
                        ))}
                      </tr>
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