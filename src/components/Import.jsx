import React, { useState } from "react";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import axios from 'axios';
import FileUpload from './FileUpload';
import '../App.css';

const Import = () => {
  const [file, setFile] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [courseVersionDate, setCourseVersionDate] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const messageClass = `${messageType}-message`;
  const sheetOptions = ["Active", "Graduate", "Withdraw", "Course Structure"];
  const showVariantPicker = selectedSheet === "Course Structure";

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setUploadProgress(0);
    setMessage("");
    setIsProcessing(false);
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

    if (selectedSheet === "Course Structure" && !courseVersionDate) {
      setMessage("Please select Year/Month");
      setMessageType("error");
      return;
    }

    const versionStr = courseVersionDate ? courseVersionDate.format('YYYY-MM') : '';
    if (selectedSheet === 'Course Structure' && !versionStr) {
      setMessage("Please select Year/Month");
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
    if (versionStr) {
      formData.append("courseVersionDate", versionStr);
    }

    try {
      setUploadProgress(0);
      setIsProcessing(false);
      setMessage("");

      const res = await axios.post("http://localhost:5001/api/import", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          if (percentCompleted === 100) {
            setIsProcessing(true);
          }
        },
      });

      setMessage(res.data.message);
      setMessageType("success");
    } catch (err) {
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
      <h2 className="text-xl font-semibold mb-4">Import Excel</h2>

      <div className="flex flex-col items-center justify-center gap-4 w-full mb-4">
        <FileUpload onFileSelect={handleFileSelect} progress={uploadProgress} />

        <div className="flex items-center justify-center gap-4 w-full mt-4">
          <select
            value={selectedSheet}
            onChange={(e) => setSelectedSheet(e.target.value)}
            className="border rounded p-2"
          >
            <option value="">-- Select Sheet Type --</option>
            {sheetOptions.map((sheet) => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>

          {showVariantPicker && (
            <select
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value)}
              className="border rounded p-2"
              aria-label="Course Structure variant"
            >
              <option value="">-- Select Variant --</option>
              <option value="standard">Current</option>
              <option value="legacy">Legacy</option>
            </select>
          )}

          {selectedSheet === "Course Structure" && (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                views={['year', 'month']}
                label="Version (YYYY-MM)"
                value={courseVersionDate}
                onChange={(v) => { setCourseVersionDate(v ? v.startOf('month') : null); }}
                format="YYYY-MM"
                slotProps={{ textField: { size: 'small', className: 'border rounded p-2' } }}
              />
            </LocalizationProvider>
          )}

          <button
            onClick={handleUpload}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={!file || (uploadProgress > 0 && uploadProgress < 100) || isProcessing}
          >
            {isProcessing ? 'Processing...' : (uploadProgress > 0 && uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Upload & Process')}
          </button>
        </div>
      </div>

      {message && <p className={messageClass}>{message}</p>}
    </div>
  );
};

export default Import;