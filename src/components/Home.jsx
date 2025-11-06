import React, { useState, useEffect } from "react";
import GraduationPieChart from "./GraduationPieChart";
import ActiveStudentsBySemPieChart from "./ActiveStudentsBySemPieChart";
import StudentsBySemBarChart from "./StudentsBySemBarChart";
import StudentStatusPieChart from "./StudentStatusPieChart";
import api from "../services/api";

const Home = () => {
  const [activeStudentsBySemData, setActiveStudentsBySemData] = useState(null);
  const [studentsBySemData, setStudentsBySemData] = useState(null);
  const [studentStatusData, setStudentStatusData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get("/students");
        const students = response.data;

        // Process for StudentStatusPieChart
        const statusCounts = students.reduce((acc, student) => {
          const status = student.STUDENT_STATUS || "Unknown";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        const statusChartData = Object.keys(statusCounts).map(status => ({
          STUDENT_STATUS: status,
          count: statusCounts[status]
        }));
        setStudentStatusData(statusChartData);

        // Process for StudentsBySemBarChart
        const semCounts = students.reduce((acc, student) => {
          const sem = student.SEM || "Unknown";
          acc[sem] = (acc[sem] || 0) + 1;
          return acc;
        }, {});
        const semChartData = Object.keys(semCounts).map(sem => ({
          SEM: sem,
          count: semCounts[sem]
        })).sort((a, b) => a.SEM - b.SEM);
        setStudentsBySemData(semChartData);

        // Process for ActiveStudentsBySemPieChart
        const activeStudents = students.filter(s => s.STUDENT_STATUS === 'Active');
        const activeSemCounts = activeStudents.reduce((acc, student) => {
          const sem = student.SEM || "Unknown";
          acc[sem] = (acc[sem] || 0) + 1;
          return acc;
        }, {});
        const activeSemChartData = Object.keys(activeSemCounts).map(sem => ({
          SEM: sem,
          count: activeSemCounts[sem]
        })).sort((a, b) => a.SEM - b.SEM);
        setActiveStudentsBySemData(activeSemChartData);

      } catch (error) {
        console.error("Error fetching student data:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="flex flex-col items-start p-4">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-lg text-gray-700 mb-8">
        An overview of student data and predictions.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <div className="bg-white p-4 rounded-lg shadow h-80">
          <StudentsBySemBarChart data={studentsBySemData} />
        </div>
        <div className="bg-white p-4 rounded-lg shadow h-80">
          <ActiveStudentsBySemPieChart data={activeStudentsBySemData} />
        </div>
        <div className="bg-white p-4 rounded-lg shadow h-80">
          <GraduationPieChart />
        </div>
        <div className="bg-white p-4 rounded-lg shadow h-80">
          <StudentStatusPieChart data={studentStatusData} />
        </div>
      </div>
    </div>
  );
};

export default Home;