import React, { useState, useEffect } from "react";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import axios from 'axios';
import FileUpload from './FileUpload';
import '../App.css';
import { MdPersonAddAlt1, MdPersonRemoveAlt1 } from "react-icons/md";
import { GiGraduateCap } from "react-icons/gi";
import { TbBook2 } from "react-icons/tb";

const Import = () => {
  const [file, setFile] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [programs, setPrograms] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const messageClass = `${messageType}-message`;
  const sheetOptions = [
    { name: "Active", icon: <MdPersonAddAlt1 size={24} /> },
    { name: "Graduate", icon: <GiGraduateCap size={24} /> },
    { name: "Withdraw", icon: <MdPersonRemoveAlt1 size={24} /> },
    { name: "Course Structure", icon: <TbBook2 size={24} /> },
  ];

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await axios.get('http://localhost:5001/api/admin/programs', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setPrograms(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch programs", err);
      }
    };
    if (currentStep === 2 && selectedSheet === 'Course Structure') {
        fetchPrograms();
    }
  }, [currentStep, selectedSheet]);

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setProgress(0);
    setMessage("");
    setIsProcessing(false);
  };

  const handleSheetSelect = (sheet) => {
    setSelectedSheet(sheet);
    setCurrentStep(2);
  };

  const handleBack = () => {
    setFile(null);
    setSelectedSheet("");
    setSelectedVariant("");
    setSelectedProgram("");
    setMessage("");
    setProgress(0);
    setIsProcessing(false);
    setCurrentStep(1);
  };

  const handleUpload = async () => {
    if (!file || !selectedSheet) {
      setMessage("Please select a file and sheet type");
      setMessageType("error");
      return;
    }

    if (selectedSheet === "Course Structure" && !selectedVariant) {
      setMessage("Please select standard/legacy for Course Structure");
      setMessageType("error");
      return;
    }

    if (selectedSheet === "Course Structure" && !selectedProgram) {
      setMessage("Please select a program");
      setMessageType("error");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("You must be logged in to upload files");
      setMessageType("error");
      window.location.href = "/login";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("selectedSheet", selectedSheet);
    formData.append("isLegacy", String(selectedVariant === "legacy"));
    if (selectedProgram) {
      formData.append("program", selectedProgram);
    }

    try {
      setProgress(0);
      setIsProcessing(false);
      setMessage("");

      const res = await axios.post("http://localhost:5001/api/import", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(Math.round(percentCompleted / 2));
          if (percentCompleted === 100) {
            setIsProcessing(true);
          }
        },
      });

      setProgress(100);
      setMessage(res.data.message);
      setMessageType("success");
    } catch (err) {
      setProgress(0);
      if (err.response && err.response.status === 401) {
        setMessage("Session expired, please log in again");
        setMessageType("error");
        localStorage.removeItem("token");
        window.location.href = "/login";
      } else {
        setMessage(err.response?.data?.error || `Error: ${err.message}`);
        setMessageType("error");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full">
      {/* <h2 className="text-xl font-semibold mb-4">Import Excel Data</h2> */}

      {currentStep === 1 && (
        <div className="max-w-2xl mx-auto">
          <h3 className="text-lg font-medium mb-2 text-center">Step 1: Select the type of data to import</h3>
          <div className="grid grid-cols-2 gap-4">
            {sheetOptions.map((option) => (
              <button
                key={option.name}
                onClick={() => handleSheetSelect(option.name)}
                className="p-6 border rounded-lg text-center hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2"
              >
                {option.icon}
                <span>{option.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="max-w-6xl mx-auto">
            <div className="relative flex items-center justify-center mb-4">
                <button onClick={handleBack} className="absolute left-0 text-blue-600 hover:underline">
                    &larr; Back
                </button>
                <h3 className="text-lg font-medium text-center">Step 2: Upload File for "{selectedSheet}"</h3>
            </div>

            <div className="flex flex-col items-center justify-center gap-6 w-full mb-4">
                {selectedSheet === "Course Structure" && (
                <div className="flex items-center justify-center gap-4 w-full">
                    <select
                    value={selectedVariant}
                    onChange={(e) => setSelectedVariant(e.target.value)}
                    className="border rounded p-2"
                    >
                    <option value="">-- Select Variant --</option>
                    <option value="standard">Current</option>
                    <option value="legacy">Legacy</option>
                    </select>

                    <select
                    value={selectedProgram}
                    onChange={(e) => setSelectedProgram(e.target.value)}
                    className="border rounded p-2"
                    >
                    <option value="">-- Select Program --</option>
                    {programs.map((prog) => (
                        <option key={prog} value={prog}>
                        {prog}
                        </option>
                    ))}
                    </select>

                </div>
                )}

                <FileUpload onFileSelect={handleFileSelect} progress={progress} />

                <button
                onClick={handleUpload}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg hover:bg-blue-700"
                disabled={!file || (progress > 0 && progress < 100) || isProcessing}
                >
                {isProcessing ? 'Processing...' : 'Upload & Process'}
                </button>
            </div>
        </div>
      )}

      {message && <p className={messageClass}>{message}</p>}
    </div>
  );
};

export default Import;