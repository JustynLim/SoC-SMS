import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthWrapper } from './components/AuthWrapper.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import CourseStructurePage from './pages/CourseStructurePage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import StudentsPage from './pages/StudentsPage.jsx';
import StudentsScoresPage from './pages/StudentsScoresPage.jsx';
import StudentDetailsPage from "./pages/StudentDetailsPage.jsx";
import GenerateListPage from  './pages/GenerateListPage.jsx';
import AdminSettingsPage from './pages/AdminSettingsPage.jsx';
//import Sidebar from './components/Sidebar.jsx';
//import { SetupGuard } from './components/SetupGuard.jsx';     << No longer needed


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected + Setup routes */}
        <Route element={<AuthWrapper />}>
          {/* Setup route (guarded in AuthWrapper) */}
          <Route path="/setup" element={<SetupPage />} />

          {/* Main protected app */}
          {/* If you need to edit url structure, do it here */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/course-structure" element={<CourseStructurePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/students-info" element={<StudentsPage />} />
          <Route path="/students-scores" element={<StudentsScoresPage />} />
          <Route path="/students-info/:matricNo" element={<StudentDetailsPage />} />
          <Route path="/generate-list" element={<GenerateListPage />} />
          <Route path="/admin-settings" element={<AdminSettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;