import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import isEmail from 'validator/lib/isEmail';

export default function Register() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    twoFACode: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [adminSetupInfo, setAdminSetupInfo] = useState(null);
  const [admin2FACode, setAdmin2FACode] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  // const [adminVerified, setAdminVerified] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const navigate = useNavigate();


  // Fetch isFirstUser flag from backend on component mount
  useEffect(() => {
    const checkIfFirstUser = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/check-first-user');
        if (!response.ok) throw new Error('Failed to check first user status');
        const data = await response.json();
        setIsFirstUser(data.isFirstUser);  // Set the flag based on the response
      } 
      catch (error) {
        console.error('Error checking first user:', error);
      }
    };

    checkIfFirstUser();
  }, []);

  // const validate = () => {
  //   const newErrors = {};
  //   if (!isEmail(form.email)) newErrors.email = 'Enter a valid email';
  //   if (!form.password) newErrors.password = 'Password is required';
  //   if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
  //   if (isFirstUser && form.twoFACode) { // Only require 2FA code if not the first user
  //     // Only require 2FA code *after* adminSetupInfo is shown (i.e., after QR code is given)
  //   if (!/^\d{6}$/.test(form.twoFACode)) {newErrors.twoFACode = 'Enter a valid 6-digit 2FA code';}
  //   }
  //     //if (adminSetupInfo && !/^\d{6}$/.test(form.twoFACode)) {newErrors.twoFACode = 'Enter a valid 6-digit 2FA code';}
  //   setErrors(newErrors);
  //   return Object.keys(newErrors).length === 0;
  // };

    const validate = () => {
    const newErrors = {};
    if (!isEmail(form.email)) newErrors.email = 'Enter a valid email';
    if (!form.password) newErrors.password = 'Password is required';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!isFirstUser && !/^\d{6}$/.test(form.twoFACode)) {
      newErrors.twoFACode = 'Enter a valid 6-digit 2FA code';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    if (!validate()) {
      setIsLoading(false);
      return;
    }

    //const requestData = {...form};

    // if (isFirstUser){
    //     delete requestData.twoFACode;
    // }

  //   try {
  //     const response = await fetch('http://localhost:5001/api/register', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify(requestData)
  //     });

  //     if(!response.ok){
  //       const errorData = await response.json().catch(() => ({}));
  //       throw new Error(data.error || "Registration failed (77)");
  //     }

  //     const text = await response.text(); // Read as txt 1st
  //     console.log(`Status: ${response.status}`,`Response text: ${text}`)

  //     let data = {};
  //     try {
  //       data = JSON.parse(text); // Try to parse JSON
  //     } 
  //     catch {
  //       throw new Error('Invalid server response (not JSON)');
  //     }

  //     //const data = await res.json();

  //     if (!response.ok) throw new Error(data.error || 'Registration failed');

  //     if (data.isAdmin) {
  //       setAdminSetupInfo({
  //         qrUrl: data.qrUrl,
  //         manualCode: data.manualCode
  //       });
  //     }

  //     setRegistrationSuccess(true);
      
  //   //   if (!data.isAdmin){
  //   //   setTimeout(() => navigate('/login'), 4000);
  //   //   }
  //   } 
    
  //   catch (err) {
  //     setErrors({ api: err.message });
  //     console.error(`Registration error: ${err.message}`);
  //   }
  // };

      try {
      const response = await fetch('http://localhost:5001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      // First check if the response is OK
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Registration failed');
      }

      // Try to parse JSON
      const data = await response.json();

      if (data.isAdmin) {
        setAdminSetupInfo({
          qrUrl: data.qrUrl,
          manualCode: data.manualCode
        });
      }

      setRegistrationSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
      
    } catch (err) {
      console.error('Registration error:', err);
      setErrors({ api: err.message || 'Registration failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container"> {/* Using the same full-page container */}
      <div className="login-box"> {/* New class for the register box */}
        <h1 className="login-header">Register</h1> {/* New class for header */}

        {errors.api && (
          <div className="api-error">
            {errors.api}
          </div>
        )}
        {registrationSuccess && (
          <div className="success-message"> {/* New class for success message */}
            Registration successful! Redirecting...
          </div>
        )}

        {!registrationSuccess && (
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
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={form.confirmPassword}
                onChange={handleChange}
                className={`login-input ${errors.confirmPassword ? 'error' : ''}`}
              />
              {errors.confirmPassword && (
                <p className="error-message">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div>
              <input
              type="text"
              name="twoFACode"
              placeholder="Enter 6-digit 2FA code"
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
              className="login-button" // New class for button
            >
              {isLoading ? 'Registering...' : 'Register'}
            </button>
          </form>
        )}

        <div className="login-links"> {/* New class for links container */}
          <Link to="/login" className="login-link"> {/* New class for link */}
            Already have an account? Login
          </Link>
        </div>
      </div>
    </div>
  );
};

