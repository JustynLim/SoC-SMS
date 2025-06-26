import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import isEmail from 'validator/lib/isEmail';

export default function Login() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    twoFACode: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    // Clear error when typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Basic validation
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

    if (!form.twoFACode || !/^\d{6}$/.test(form.twoFACode)) {
      setErrors({ twoFACode: 'Please enter a valid 6-digit code' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          twoFACode: form.twoFACode
        }),
        credentials: 'include' // For JWT cookies
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and redirect
      localStorage.setItem('token', data.accessToken);
      navigate('/home');
    } catch (err) {
      setErrors({ api: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
  <div className="login-box">
    <h1 className="login-header">Login</h1>
    
    {errors.api && (
      <div className="api-error">
        {errors.api}
      </div>
    )}

    <form onSubmit={handleSubmit}>
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

      <div>
        <input
          type="text"
          name="twoFACode"
          placeholder="2FA Code"
          value={form.twoFACode}
          onChange={handleChange}
          className={`login-input ${errors.twoFACode ? 'error' : ''}`}
          pattern="\d{6}"
          maxLength={6}
        />
        {errors.twoFACode && (
          <p className="error-message">
            {errors.twoFACode}
          </p>
        )}
      </div>
      
      <button
        type="submit"
        disabled={isLoading}
        className="login-button"
      >
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
    
    <div className="login-links">
      <Link to="/register" className="login-link">
        Create Account
      </Link>
    </div>
  </div>
);
}
