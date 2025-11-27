import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const GraduationStatusModal = ({ isOpen, onClose, onTimeStudents, atRiskStudents, initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) {
    return null;
  }

  const studentsToShow = activeTab === 'on-time' ? onTimeStudents : atRiskStudents;
  const tabName = activeTab === 'on-time' ? 'On Time' : 'At Risk';


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-3/4 max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Student Graduation Status</h2>
          <button onClick={onClose} className="text-black text-2xl">&times;</button>
        </div>
        
        <div className="flex border-b mb-4">
          <button 
            className={`py-2 px-4 ${activeTab === 'on-time' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
            onClick={() => setActiveTab('on-time')}
          >
            On Time
          </button>
          <button 
            className={`py-2 px-4 ${activeTab === 'at-risk' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
            onClick={() => setActiveTab('at-risk')}
          >
            At Risk
          </button>
        </div>

        <div className="overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">{tabName} Students ({studentsToShow.length})</h3>
          <table className="min-w-full bg-white">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 border-b">Student ID</th>
                <th className="py-2 px-4 border-b">Student Name</th>
              </tr>
            </thead>
            <tbody>
              {studentsToShow.map(student => (
                <tr key={student.StudentID} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b text-center">{student.StudentID}</td>
                  <td className="py-2 px-4 border-b text-center">
                    <Link to={`/students-info/${student.StudentID}`} className="text-blue-500 hover:underline">
                      {student.StudentName}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default GraduationStatusModal;
