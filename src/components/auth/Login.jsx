import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import isEmail from 'validator/lib/isEmail';
import TwoFAModal from './TwoFAModal'; // Import the modal component

export default function Login() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    if (errors[name] || errors.api) {
      setErrors(prev => ({ ...prev, [name]: '', api: '' }));
    }
  };

  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    if (!isEmail(form.email)) {
      setErrors({ email: 'Please enter a valid email address' });
      setIsLoading(false);
      return;
    }

    if (!form.password) {
      setErrors({ password: 'Password is required' });
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: Verify credentials
      const response = await fetch('http://localhost:5001/api/login/verify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // If credentials are valid, clear old errors and show the 2FA modal
      setErrors({});
      setShow2FAModal(true);

    } catch (err) {
      setErrors({ api: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (twoFACode) => {
    setIsLoading(true);
    setErrors({}); // Clear previous 2FA errors

    try {
      const response = await fetch('http://localhost:5001/api/login/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          twoFACode: twoFACode,
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid 2FA code.');
      }

      // On successful 2FA verification, complete login
      localStorage.setItem('token', data.accessToken);
      setShow2FAModal(false);
      navigate('/home');

    } catch (err) {
      // Catch the error here and set the state, which is passed to the modal
      setErrors({ api: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
  <div className="login-box">
    <h1 className="login-header">Login</h1>
    
    {errors.api && !show2FAModal && (
      <div className="api-error">
        {errors.api}
      </div>
    )}

    <form onSubmit={handleCredentialSubmit}>
      <div>
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className={`login-input ${errors.email ? 'error' : ''}`}
        />
        {errors.email && (
          <p className="error-message">
            {errors.email}
          </p>
        )}
      </div>
      
      <div>
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className={`login-input ${errors.password ? 'error' : ''}`}
        />
        {errors.password && (
          <p className="error-message">
            {errors.password}
          </p>
        )}
      </div>
      
      <button
        type="submit"
        disabled={isLoading}
        className="login-button"
      >
        {isLoading ? 'Verifying...' : 'Login'}
      </button>
    </form>
    
    <div className="login-links">
      <Link to="/register" className="login-link">
        Create Account
      </Link>
    </div>

    <TwoFAModal 
      isOpen={show2FAModal}
      onClose={() => {
        setShow2FAModal(false);
        setErrors({}); // Clear errors when closing modal
      }}
      onSubmit={handle2FASubmit}
      email={form.email}
      error={errors.api} // Pass the error state to the modal
      isLoading={isLoading}
    />
  </div>
);
}
