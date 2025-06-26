// src/components/SetupGuard.jsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export function SetupGuard({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);

  useEffect(() => {
    if (isVerifying2FA) return; // Don't redirect during 2FA verification

    const checkSetupStatus = async () => {
      try {
        const response = await fetch('/api/check-setup');
        const data = await response.json();
        
      // Only redirect if setup is completed and 2FA is verified
        setShouldRedirect(!data.shouldSetup && !data.needs2FASetup);
      } catch (error) {
        console.error('Setup check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSetupStatus();
  }, [isVerifying2FA]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (shouldRedirect) {
    return <Navigate to="/login" replace />;
  }

  return children;
}