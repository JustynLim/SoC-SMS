// src/pages/StudentDetailsPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import StudentPredictionCard from '../components/StudentPredictionCard';
import { ArrowBack } from '@mui/icons-material';
import '../App.css';

export default function StudentDetailsPage() {
  const { matricNo } = useParams();
  const navigate = useNavigate();
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matricNo) return;

    // Fetch basic student info
    fetch(`http://localhost:5001/api/students?matric_no=${matricNo}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch student info');
        return res.json();
      })
      .then((json) => {
        // Assuming API returns array, take first match
        const student = Array.isArray(json) 
          ? json.find(s => s.MATRIC_NO === matricNo) 
          : json;
        setStudentInfo(student);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [matricNo]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <p>Loading student information...</p>
        </div>
      </div>
    );
  }

  if (error || !studentInfo) {
    return (
      <div className="flex h-screen w-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <button
            onClick={() => navigate('/students-info')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              marginBottom: '20px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            <ArrowBack fontSize="small" />
            Back to Students
          </button>
          <p style={{ color: 'red' }}>Error: {error || 'Student not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen">
      <Sidebar />

      <div className="flex-1 p-8 overflow-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/students-info')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            marginBottom: '20px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          <ArrowBack fontSize="small" />
          Back to Students
        </button>

        {/* Page Title */}
        <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>
          {studentInfo.STUDENT_NAME}
        </h1>

        {/* Two-column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '24px',
            maxWidth: '1400px',
          }}
        >
          {/* Left Column: Basic Info */}
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '20px',
              background: 'white',
            }}
          >
            <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
              Student Information
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InfoRow label="Matric No" value={studentInfo.MATRIC_NO} />
              <InfoRow label="Cohort" value={new Date(studentInfo.COHORT).getFullYear()} />
              <InfoRow label="Status" value={studentInfo.STUDENT_STATUS} />
              <InfoRow label="Semester" value={studentInfo.SEM || '-'} />
              <InfoRow label="CU ID" value={studentInfo.CU_ID || '-'} />
              <InfoRow label="IC No" value={studentInfo.IC_NO || '-'} />
              <InfoRow label="Mobile No" value={studentInfo.MOBILE_NO || '-'} />
              <InfoRow label="Email" value={studentInfo.EMAIL || '-'} />
              <InfoRow label="BM" value={studentInfo.BM || '-'} />
              <InfoRow label="English" value={studentInfo.ENGLISH || '-'} />
              <InfoRow label="Entry Qualification" value={studentInfo.ENTRY_Q || '-'} />
            </div>
          </div>

          {/* Right Column: Prediction - Only applicable to 'Active' students */}
          <StudentPredictionCard 
          matricNo={matricNo}
          studentStatus={studentInfo.STUDENT_STATUS} />
        </div>
      </div>
    </div>
  );
}

// Helper component for info rows
function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#666', fontSize: '14px' }}>{label}:</span>
      <span style={{ fontWeight: '500', fontSize: '14px' }}>{value || '-'}</span>
    </div>
  );
}
