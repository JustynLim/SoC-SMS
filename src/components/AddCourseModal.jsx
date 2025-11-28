import React, { useState, useEffect } from "react";
import api from "../services/api"; // Use the centralized api

const initialState = {
  COURSE_CODE: "",
  MODULE: "",
  COURSE_CLASSIFICATION: "",
  PRE_CO_REQ: "",
  CREDIT_HOUR: "",
  LECT_HR_WK: "",
  TUT_HR_WK: "",
  LAB_HR_WK: "",
  BL_HR_WK: "",
  CU_CW_Credits: "",
  CU_EX_Credits: "",
  COURSE_LEVEL: "1",
  LECTURER: "",
  COURSE_YEAR: "Year 1",
  COURSE_STATUS: "Active",
  PROGRAM_CODE: "",
};

const AddCourseModal = ({ isOpen, onClose, onCourseAdded }) => {
  const [formData, setFormData] = useState(initialState);
  const [programs, setPrograms] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [programsRes, lecturersRes] = await Promise.all([
            api.get('/admin/programs'),
            api.get('/admin/lecturers') // Corrected path
          ]);

          const programsData = programsRes.data;
          const lecturersData = lecturersRes.data;

          setPrograms(programsData);
          setLecturers(lecturersData);

          const defaultProgram = programsData.length > 0
            ? (typeof programsData[0] === 'object' ? programsData[0].PROGRAM_CODE : programsData[0])
            : '';

          // Reset form on open and set defaults
          setFormData({
            ...initialState,
            PROGRAM_CODE: defaultProgram,
            LECTURER: '' // Default to empty string, user must select
          });
          
          setError(null);
          setSuccess(null);

        } catch (err) {
          if (err.response && err.response.status === 401) {
            setError("Session expired. Redirecting to login...");
            localStorage.removeItem("token");
            setTimeout(() => { window.location.href = "/login"; }, 2000);
          } else {
            setError("Failed to fetch form data.");
            console.error(err);
          }
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const res = await api.post("/course-structure", formData);
      setSuccess(res.data.message);
      onCourseAdded(); // Callback to refresh the course list
      
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
       if (err.response && err.response.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
      } else {
        setError(err.response?.data?.error || "An error occurred.");
      }
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Add New Course</h2>
        {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>}
        {success && <p className="text-green-500 bg-green-100 p-3 rounded mb-4">{success}</p>}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Form Fields */}
            <InputField name="COURSE_CODE" label="Code" value={formData.COURSE_CODE} onChange={handleChange} required />
            <InputField name="MODULE" label="Module" value={formData.MODULE} onChange={handleChange} required />
            <ComboBoxField name="COURSE_CLASSIFICATION" label="Classification" value={formData.COURSE_CLASSIFICATION} onChange={handleChange} options={['Major', 'Minor']} />
            <ComboBoxField name="PRE_CO_REQ" label="Pre/Co Req" value={formData.PRE_CO_REQ} onChange={handleChange} options={['CS','CT','CS&CT']} />
            <InputField name="CREDIT_HOUR" label="Credit Hour" type="number" value={formData.CREDIT_HOUR} onChange={handleChange} required />
            <InputField name="LECT_HR_WK" label="Lect hr/wk" value={formData.LECT_HR_WK} onChange={handleChange} />
            <InputField name="TUT_HR_WK" label="Tut hr/wk" value={formData.TUT_HR_WK} onChange={handleChange} />
            <InputField name="LAB_HR_WK" label="Lab hr/wk" value={formData.LAB_HR_WK} onChange={handleChange} />
            <InputField name="BL_HR_WK" label="BL hr/wk" value={formData.BL_HR_WK} onChange={handleChange} />
            <InputField name="CU_CW_Credits" label="CU-CW Credits" type="number" value={formData.CU_CW_Credits} onChange={handleChange} />
            <InputField name="CU_EX_Credits" label="CU-EX Credits" type="number" value={formData.CU_EX_Credits} onChange={handleChange} />
            <SelectField name="COURSE_LEVEL" label="Level" value={formData.COURSE_LEVEL} onChange={handleChange} options={[1, 2, 3]} required />
            <SelectField name="LECTURER" label="Lecturer" value={formData.LECTURER} onChange={handleChange} options={['', ...lecturers]} />
            <SelectField name="COURSE_YEAR" label="Course Year" value={formData.COURSE_YEAR} onChange={handleChange} options={['Year 1', 'Year 2', 'Year 3', 'Compulsory']} required />
            <SelectField name="COURSE_STATUS" label="Course Status" value={formData.COURSE_STATUS} onChange={handleChange} options={['Active', 'Inactive']} required />
            <SelectField name="PROGRAM_CODE" label="Program Code" value={formData.PROGRAM_CODE} onChange={handleChange} options={programs} required />
          </div>
          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Add Course</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const InputField = ({ name, label, value, onChange, type = "text", required = false }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
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
        const optionValue = typeof option === 'object' && option !== null ? option.PROGRAM_CODE : option;
        const optionLabel = typeof option === 'object' && option !== null ? `${option.PROGRAM_CODE} - ${option.PROGRAM_DESCRIPTION || ''}` : option;
        return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
      })}
    </select>
  </div>
);

const ComboBoxField = ({ name, label, value, onChange, options, required = false }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500">*</span>}</label>
    <input
      type="text"
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      list={`${name}-list`}
      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    />
    <datalist id={`${name}-list`}>
      {options.map((option) => (
        <option key={option} value={option} />
      ))}
    </datalist>
  </div>
);

export default AddCourseModal;
