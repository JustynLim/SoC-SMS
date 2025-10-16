import React from 'react'
import './FileUpload.css'

const FileUpload = () => {
    
    const inputRef = useRef();

    //
    const [selectedFile, setSelectedFile] = useState(null);
    const [progress, setProgess] = useState(0);
    const [uploadStatus, setUploadStatus] = useState("select");
    

    return(
        <div>FileUpload</div>
    )
}

export default FileUpload