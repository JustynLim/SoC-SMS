import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export function AuthWrapper({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [shouldSetup, setShouldSetup] = useState(false);

  useEffect(() => {
    const checkInitialSetup = async () => {
      try {
        const response = await fetch('/api/check-setup');
        const data = await response.json();
        setShouldSetup(data.shouldSetup);
      } 
      catch (error) {
        console.error('Setup check failed:', error);
      }
      finally {
        setIsLoading(false);
      }
    };

    checkInitialSetup();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>; // Or your loading spinner
  }

  if (shouldSetup) {
    return <Navigate to="/setup" replace />;
  }

  return children;
}