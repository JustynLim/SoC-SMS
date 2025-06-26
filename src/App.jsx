import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthWrapper } from './components/AuthWrapper.jsx';
import {Home} from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import SetupPage from './pages/SetupPage.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root (/) to /login if admin exist */}
        <Route path="/" element={
          <AuthWrapper>
            <Navigate to="/login" replace />
          </AuthWrapper>
        } />
        
        {/* Setup route - only accessible during initial setup */}
        <Route path="/setup" element={
          <AuthWrapper>
            <SetupPage />
          </AuthWrapper>
        } />

        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


// import React from 'react';
// import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import { Home } from './pages/HomePage';
// import { LoginPage } from './pages/LoginPage';
// import { RegisterPage } from './pages/RegisterPage';

// function App() {
//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/home" element={<Home />} />
//         <Route path="/login" element={<LoginPage />} index = {true} /> {/* Default page */}
//         <Route path="/register" element={<RegisterPage />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }