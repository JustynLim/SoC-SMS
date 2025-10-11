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
  const isSetupPath =
    location.pathname === '/setup' ||
    location.pathname === '/setup/' ||
    location.pathname.startsWith('/setup/');

  // If admin exists & setup complete, block /setup from being accessed
  if (isSetupPath && adminExists && !shouldSetup && !needs2FASetup) {
    if (!isLoggedIn) {
      // not logged in = navigate to login
      return <Navigate to="/login" replace />;
    }
    // logged in = navigate to previous page (or /home)
    const last = sessionStorage.getItem('lastRoute') || '/home';
    return <Navigate to={last} replace />;
  }

  // If setup is required, force /setup (unless already there)
  if ((shouldSetup || needs2FASetup) && !isSetupPath) {
    return <Navigate to="/setup" replace />;
  }

  // Auth check for protected routes
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}