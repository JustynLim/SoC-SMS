import React, { useState, useRef } from 'react';
import './FileUpload.css';
import { FaUpload } from 'react-icons/fa';

const FileUpload = ({ onFileSelect, progress }) => {
    const [file, setFile] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
            onFileSelect(droppedFile);
        }
    };

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            onFileSelect(selectedFile);
        }
    };

    const handleClick = () => {
        fileInputRef.current.click();
    };

    return (
        <div
            className={`file-upload-container ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept=".xls,.xlsx"
            />
            {file ? (
                <div className="file-info">
                    <p className="file-name">{file.name}</p>
                    {progress > 0 && (
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <FaUpload className="upload-icon" />
                    <p>Drag & drop a file here, or click to select a file</p>
                </>
            )}
        </div>
    );
};

export default FileUpload;