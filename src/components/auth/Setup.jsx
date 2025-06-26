import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import isEmail from 'validator/lib/isEmail';

export const Setup = () => {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [errors, setErrors] = useState({});
  const [adminSetupInfo, setAdminSetupInfo] = useState(null);
  const [admin2FACode, setAdmin2FACode] = useState('');
  const [currentStep, setCurrentStep] = useState('register'); // 'register', 'setup2fa', 'complete'
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!isEmail(form.email)) newErrors.email = 'Enter a valid email';
    if (!form.password) newErrors.password = 'Password is required';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

const handleRegister = async (e) => {
  e.preventDefault();
  if (!validate()) return;
  setIsVerifying2FA(true); // Use this for registration loading state

  try {
    const response = await fetch('http://localhost:5001/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    console.log('Raw response:', response); // Debug log

    const data = await response.json().catch(() => {
      throw new Error('Invalid JSON response');
    });

    console.log('Parsed data:', data); // Debug log

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    if (!data.qrUrl || !data.manualCode) {
      throw new Error('Missing 2FA setup data in response');
    }

    // Ensure these are set together in one operation
    setAdminSetupInfo({
      qrUrl: data.qrUrl,
      manualCode: data.manualCode
    });
    setCurrentStep('setup2fa');
    
  } catch (err) {
    console.error('Registration error:', err);
    setErrors({ api: err.message });
  } finally {
    setIsVerifying2FA(false);
  }
};


  const handleVerify2FA = async () => {
    setIsVerifying2FA(true);
    try {
      const response = await fetch('http://localhost:5001/api/verify-2fa-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: admin2FACode })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Verification failed" }));
        throw new Error(errorData.error || 'Invalid 2FA code');
      }

      setCurrentStep('complete');
      setTimeout(() => navigate('/login'), 2000);
      
    } catch (error) {
      alert(error.message);
      console.error('2FA verification error:', error);
    } finally {
      setIsVerifying2FA(false);
    }
  };

  return (
    <>
      {/* STEP 1: Registration Form */}
      {currentStep === 'register' && (
        <div className='register-page-container'>
          <div className='register-box'>
            <h1 className="register-header">
              <span>Welcome!</span>
              <span>Please create an admin account</span>
            </h1>
            {/* <h1 style={{ textAlign: 'center' }}>Welcome! Please create an admin account</h1> */}
            {errors.api && <p style={{ color: 'red' }}>{errors.api}</p>}
            
            <form onSubmit={handleRegister}>
              <div>
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={handleChange}
                  className={`register-input ${errors.email ? 'error' : ''}`}
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
                  className={`register-input ${errors.password ? 'error' : ''}`}
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
                  className={`register-input ${errors.confirmPassword ? 'error' : ''}`}
                />
                {errors.confirmPassword && (
                  <p className="error-message">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <button 
              type="submit"
              disabled={isVerifying2FA}
              className="register-button"
              >
                {isVerifying2FA ? 'Registering...' : 'Register'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2: 2FA Setup - Will stay visible until manually verified */}
      {currentStep === 'setup2fa' && adminSetupInfo && (
        <div className='twofa-page-container'>
          <div className='twofa-setup-box'>
            <h1 className="twofa-header">Admin 2FA Setup</h1>
            
            <div className="twofa-setup-container">
              <p>Scan the QR code with your authenticator app:</p>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(adminSetupInfo.qrUrl)}&size=200x200`} 
                alt="2FA QR" 
                className="twofa-qr-code"
              />
              
              <p>Or enter this code manually:</p>
              <div className="twofa-manual-code">
                {adminSetupInfo.manualCode}
              </div>

              <form onSubmit={(e) =>{
                e.preventDefault();
                handleVerify2FA();
              }}>
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={admin2FACode}
                    placeholder="Enter 6-digit 2FA code"
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setAdmin2FACode(value);
                      if (errors.twoFA) setErrors(prev => ({ ...prev, twoFA: '' }));
                    }}
                    className={`register-input ${errors.twoFA ? 'error' : ''}`}
                    autoFocus
                  />
                  {errors.twoFA && <p className="error-message">{errors.twoFA}</p>}
                </div>

              <button
                type="submit"
                //onClick={handleVerify2FA}
                disabled={isVerifying2FA || admin2FACode.length !== 6}
                className="register-button"
              >
                {isVerifying2FA ? 'Verifying...' : 'Verify 2FA'}
                </button>
              </form>
            </div>
        </div>
      </div>
      )}

      {/* STEP 3: Completion Screen */}
      {currentStep === 'complete' && (
        <div className='register-page-container'>
          <div className='twofa-setup-box'>
            <h1 className="twofa-header">Setup Complete!</h1>
            <div className="success-message">
              2FA verified successfully. Redirecting to login...
            </div>
          </div>
        </div>
      )}
    </>
  );
};