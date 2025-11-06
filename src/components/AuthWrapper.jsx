import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function AuthWrapper() {
  const [isLoading, setIsLoading] = useState(true);
  const [shouldSetup, setShouldSetup] = useState(false);
  const [needs2FASetup, setNeeds2FASetup] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  const location = useLocation();

  // Track last *useful* route (avoid auth/setup pages)
  useEffect(() => {
    const p = location.pathname;
    const isAuthOrSetup =
      p === '/login' || p === '/register' || p.startsWith('/setup');
    if (!isAuthOrSetup) {
      sessionStorage.setItem('lastRoute', p);
    }
  }, [location]);

  useEffect(() => {
  async function checkInitialSetup() {
    try {
      const response = await fetch('http://localhost:5001/api/check-setup');
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error ${response.status}: ${text}`);
      }
      const data = await response.json();

      console.log("📦 Updated React state from API:", data);

      setShouldSetup(Boolean(data.shouldSetup));
      setNeeds2FASetup(Boolean(data.needs2FASetup));
      setAdminExists(Boolean(data.adminExists));
    } catch (error) {
      console.error("Setup check failed:", error);
    } finally {
      setIsLoading(false);
    }
  }
  checkInitialSetup();
}, []);


  if (isLoading) {
    return <div>Loading...</div>;
  }

  const isLoggedIn = !!localStorage.getItem('token');
  const isSetupPath = location.pathname.startsWith('/setup');

  // 1. If setup is required, handle that first.
  if (shouldSetup || needs2FASetup) {
    // If we're not on the setup page, go there.
    if (!isSetupPath) {
      return <Navigate to="/setup" replace />;
    }
    // If we are on the setup page, allow it.
    return <Outlet />;
  }

  // 2. If we are here, setup is NOT required.
  // If user tries to access /setup, redirect them.
  if (isSetupPath) {
      return <Navigate to="/home" replace />;
  }

  // 3. For all other pages, user must be logged in.
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  // 4. User is logged in, and setup is not required.
  return <Outlet />;
}