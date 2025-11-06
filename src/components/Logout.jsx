import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await axios.post('http://localhost:5001/api/logout', {}, { withCredentials: true });
      } catch (error) {
        console.error('Logout failed:', error);
      } finally {
        // Clear any client-side stored tokens/user data
        localStorage.removeItem('token'); // Assuming you store token in localStorage
        // Redirect to login page
        navigate('/login');
      }
    };

    performLogout();
  }, [navigate]);

  return (
    <div>
      <p>Logging out...</p>
    </div>
  );
};

export default Logout;