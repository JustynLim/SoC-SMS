import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, []);

  return (
    <div>
      <h1>Welcome to the homepage!</h1>
      <button onClick={() => {localStorage.removeItem('token');navigate('/login');}}>Logout</button>
    </div>
  );
};