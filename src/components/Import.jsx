import React, { useState } from "react";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {DatePicker} from "@mui/x-date-pickers/DatePicker";
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider'
import '../App.css';


const Import = () => {
  const [file, setFile] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [courseVersionDate, setCourseVersionDate] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const messageClass = `${messageType}-message`
  const sheetOptions = ["Active", "Graduate", "Withdraw", "Course Structure"];
  const showVariantPicker = selectedSheet === "Course Structure";

  const handleUpload = async () => {
    if (!file || !selectedSheet) {
      setMessage("Please select a file and sheet type");
      setMessageType("error");
      return;
    }

    if (selectedSheet === "Course Structure" && !selectedVariant){
      setMessage("Please select standard/legacy for Course Structure");
      setMessageType("error");
      return;
    }

    if (selectedSheet === "Course Structure" && !courseVersionDate){
      setMessage("Please select Year/Month");
      setMessageType("error");
      return;
    }

    const versionStr = courseVersionDate ? courseVersionDate.format('YYYY-MM') : '';
      { /* error */ }
      if (selectedSheet === 'Course Structure' && !versionStr){
        setMessage("Please select Year/Month");
        setMessageType("error");
        return;
      }

    const token = localStorage.getItem("token"); // 👈 fetch saved JWT
    if (!token) {
      setMessage("You must be logged in to upload files");
      setMessageType("error");
      // optionally redirect to login page:
      window.location.href = "/login";
      return;
    }
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("selectedSheet", selectedSheet);
    formData.append("isLegacy", String(selectedVariant === "legacy"));
    if (versionStr) {
      // align with backend: request.form.get('courseVersionDate')
      formData.append("courseVersionDate", versionStr);
    }
    
    try {
        const res = await fetch("http://localhost:5001/api/import", {
          method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}` // 👈 send JWT
            },
          body: formData
        });
      // const res = await fetch("/api/import", {
      //   method: "POST",
      //   body: formData
      // });
      
    if (res.status === 401) {
      // token invalid/expired
      setMessage("Session expired, please log in again");
      setMessageType("error");
      localStorage.removeItem("token"); // clear bad token
      window.location.href = "/login";
      return;
    }
      
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setMessageType("success")
      } else {
        setMessage(data.error || "Processing failed");
        setMessageType("error")
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Import Excel</h2>

      <div className="flex items-center justify-between gap-4 w-full mb-4">
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => setFile(e.target.files[0])}
          className="flex-1 border rounded p-2"
        />

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

        {/* Show month/year picker only when Course Structure is selected */}
        {selectedSheet === "Course Structure" && (
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              views={['year','month']}
              label="Version (YYYY-MM)"
              value={courseVersionDate}
              onChange={(v) => {setCourseVersionDate(v ? v.startOf('month') : null);}}
              format="YYYY-MM"
              slotProps={{textField: {size: 'small', className: 'border rounded p-2'} }}
            />
          </LocalizationProvider>
        )}



        <button
          onClick={handleUpload}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Upload & Process
        </button>
      </div>

      {message && <p className={messageClass}>{message}</p>}
    </div>
  );
};

export default Import;