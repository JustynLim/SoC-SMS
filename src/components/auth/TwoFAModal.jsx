import React, { useState, useRef, useEffect } from 'react';
import './TwoFAModal.css';

const TwoFAModal = ({ isOpen, onClose, onSubmit, email, error, isLoading }) => {
  const [codes, setCodes] = useState(Array(6).fill(''));
  const [lastSubmittedCode, setLastSubmittedCode] = useState(null);
  const inputsRef = useRef([]);

  // Use a ref to hold the latest onSubmit function to avoid re-triggering the effect
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  // Auto-submit when all 6 digits are entered and not already loading
  useEffect(() => {
    const code = codes.join('');
    if (code.length === 6 && !isLoading && code !== lastSubmittedCode) {
      setLastSubmittedCode(code); // Mark this code as submitted
      onSubmitRef.current(code);
    }
  }, [codes, isLoading, lastSubmittedCode]);

  useEffect(() => {
    if (isOpen) {
      // Focus the first input and clear codes when the modal opens
      inputsRef.current[0]?.focus();
      setCodes(Array(6).fill(''));
      setLastSubmittedCode(null); // Reset submission tracking
    }
  }, [isOpen]);

  const handleCodeChange = (e, index) => {
    const { value } = e.target;
    // Allow only digits
    if (/^[0-9]$/.test(value) || value === '') {
      const newCodes = [...codes];
      newCodes[index] = value;
      setCodes(newCodes);

      // Focus next input on entry
      if (value !== '' && index < 5) {
        inputsRef.current[index + 1].focus();
      }
    }
  };

  const handleKeyDown = (e, index) => {
    // Move focus backward on backspace
    if (e.key === 'Backspace' && codes[index] === '' && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    if (/^\d{6}$/.test(paste)) {
      setCodes(paste.split(''));
      // The useEffect will handle the submission automatically
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const twoFACode = codes.join('');
    // Basic validation can still happen here if desired, but the async logic is moved.
    if (twoFACode.length === 6) {
      onSubmit(twoFACode);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button onClick={onClose} className="close-button">&times;</button>
        <h2>2FA Verification</h2>
        <p>Enter the 6-digit code from your authenticator app.</p>
        {error && <p className="error-message" style={{ color: '#dc3545' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="code-inputs" onPaste={handlePaste}>
            {codes.map((code, index) => (
              <input
                key={index}
                ref={el => inputsRef.current[index] = el}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="1"
                value={code}
                onChange={(e) => handleCodeChange(e, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="code-input"
                required
              />
            ))}
          </div>
          <button type="submit" disabled={isLoading} className="verify-button">
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TwoFAModal;
