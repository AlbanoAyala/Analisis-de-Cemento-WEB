
import React, { useState, useCallback } from 'react';

// Define Icons within the component to reduce file count
const UploadIcon = () => (
    <svg className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
    </svg>
);

const FileIcon = () => (
    <svg className="w-8 h-8 mr-2 text-brand-primary" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 20">
        <path d="M14.066 0H7.667L6 2H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2Zm-5 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-1 8H5a1 1 0 0 1 0-2h3a1 1 0 0 1 0 2Z"/>
    </svg>
);


interface FileUploadProps {
  onFileLoaded: (content: string | ArrayBuffer) => void;
  acceptedTypes: string;
  label: string;
  isBinary?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, acceptedTypes, label, isBinary = false }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onFileLoaded(e.target.result);
        }
      };
      if (isBinary) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    }
  }, [onFileLoaded, isBinary]);

  const onDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleFile(event.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);
  
  const onDragEnter = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const onDragLeave = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      handleFile(event.target.files[0]);
    }
  };

  return (
    <div>
      <label htmlFor={`dropzone-file-${label}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300
                    ${isDragging ? 'border-brand-primary bg-gray-700' : 'border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600'}`}>
        {fileName ? (
          <div className="flex items-center">
            <FileIcon />
            <span className="font-semibold text-gray-300">{fileName}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadIcon />
            <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        )}
        <input id={`dropzone-file-${label}`} type="file" className="hidden" accept={acceptedTypes} onChange={onFileChange} />
      </label>
    </div>
  );
};

export default FileUpload;
