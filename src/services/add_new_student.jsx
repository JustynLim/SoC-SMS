import React, { useState, useEffect } from "react";
import api from "./api";
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

const InputField = ({ name, label, value, onChange, type = "text", required = false, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      {...props}
      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    />
  </div>
);

const SelectField = ({ name, label, value, onChange, options, required = false }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500">*</span>}</label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    >
                    {options.map((option) => {
                      const optionValue = typeof option === 'object' ? option.PROGRAM_CODE : option;
                      const optionLabel = typeof option === 'object' ? option.PROGRAM_CODE : option;
                      return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
                    })}    </select>
  </div>
);

const initialState = {
  STUDENT_NAME: "",
  COHORT: "",
  SEM: "1",
  CU_ID: "",
  IC_NO: "",
  MOBILE_NO: "",
  EMAIL: "",
  BM: "A",
  ENGLISH: "A",
  ENTRY_Q: "",
  MATRIC_NO: "",
  PROGRAM_CODE: "",
};

export default function AddNewStudent({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState(initialState);
  const [programs, setPrograms] = useState([]); // Changed from courseVersions
  const [idType, setIdType] = useState('IC'); // Add state for ID Type
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const fetchPrograms = async () => { // Changed from fetchCourseVersions
        try {
          const res = await api.get("/admin/programs"); // Changed endpoint
          const programData = res.data || [];
          setPrograms(programData);
          if (programData.length > 0) {
            const defaultProgram = typeof programData[0] === 'object' ? programData[0].PROGRAM_CODE : programData[0];
            setFormData(prev => ({ ...prev, PROGRAM_CODE: defaultProgram }));
          }
        } catch (err) {
          if (err.response && err.response.status === 401) {
            setError("Session expired. Redirecting to login...");
            localStorage.removeItem("token");
            setTimeout(() => {
              window.location.href = "/login";
            }, 2000);
          } else {
            console.error("Failed to fetch programs:", err);
            setError("Failed to load programs.");
          }
        }
      };
      fetchPrograms();
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'IC_NO' && idType === 'IC') {
      const digits = value.replace(/[^\d]/g, '');
      const truncatedDigits = digits.slice(0, 12);
      let formatted = truncatedDigits;

      if (truncatedDigits.length > 8) {
        formatted = `${truncatedDigits.slice(0, 6)}-${truncatedDigits.slice(6, 8)}-${truncatedDigits.slice(8)}`;
      } else if (truncatedDigits.length > 6) {
        formatted = `${truncatedDigits.slice(0, 6)}-${truncatedDigits.slice(6)}`;
      }

      setFormData((prev) => ({ ...prev, IC_NO: formatted }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Email validation
    if (formData.EMAIL && !/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(formData.EMAIL)) {
        setError("Please enter a valid email address.");
        return;
    }

    // Final validation before submitting
    if (!/^P\d{8}$/.test(formData.MATRIC_NO)) {
        setError("Invalid Matric No format. Please use P followed by 8 digits.");
        return;
    }

    setLoading(true);

    const payload = { ...formData };
    // Handle Mobile No: if it's just a country code, send empty string to be saved as '-'
    if (payload.MOBILE_NO && payload.MOBILE_NO.length <= 5) {
      payload.MOBILE_NO = "";
    } else if (payload.MOBILE_NO) {
      payload.MOBILE_NO = payload.MOBILE_NO.replace(/^\+/, '');
    }

    try {
      const res = await api.post("/add-student", payload);
      onSuccess(res.data.message || "Student added successfully");
      onClose();
      setFormData(initialState); // Reset form
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError("Session expired. Redirecting to login...");
        localStorage.removeItem("token");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        setError(err.response?.data?.error || "An error occurred while adding the student.");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Add New Student</h2>
        
        {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <InputField name="STUDENT_NAME" label="Name" value={formData.STUDENT_NAME} onChange={handleChange} required />
            </div>
            <InputField name="MATRIC_NO" label="Matric No" value={formData.MATRIC_NO} onChange={handleChange} required pattern="P\d{8}" title="Must start with 'P' followed by 8 digits." />
            <InputField name="CU_ID" label="CU ID" value={formData.CU_ID} onChange={handleChange} required />
            <SelectField name="idType" label="ID Type" value={idType} onChange={(e) => setIdType(e.target.value)} options={['IC', 'Passport']} />
            <InputField name="IC_NO" label="IC/Passport No" value={formData.IC_NO} onChange={handleChange} required />
            <InputField name="COHORT" label="Cohort" type="date" value={formData.COHORT} onChange={handleChange} required />
            <SelectField name="SEM" label="Semester" min="1" value={formData.SEM} onChange={handleChange} options={[1,4]} required />
            <div className="md:col-span-2">
                <SelectField name="PROGRAM_CODE" label="Program Code" value={formData.PROGRAM_CODE} onChange={handleChange} options={programs} required />
            </div>
            <div>
              <label htmlFor="MOBILE_NO" className="block text-sm font-medium text-gray-700">Mobile No</label>
              <PhoneInput
                defaultCountry="my"
                value={formData.MOBILE_NO}
                onChange={(phone) => setFormData(prev => ({ ...prev, MOBILE_NO: phone }))}
                className="mt-1"
                inputClassName="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <InputField name="EMAIL" label="Email" type="email" value={formData.EMAIL} onChange={handleChange} pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}" title="Please enter a valid email address (e.g., user@example.com)" />
            <SelectField name="BM" label="BM" value={formData.BM} onChange={handleChange} options={['A','B','C','D','E','F']} />
            <SelectField name="ENGLISH" label="English" value={formData.ENGLISH} onChange={handleChange} options={['A','B','C','D','E','F']} />
            <InputField name="ENTRY_Q" label="Entry-Q" value={formData.ENTRY_Q} onChange={handleChange} />
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400">
              Cancel
            </button>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {loading ? "Adding..." : "Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}