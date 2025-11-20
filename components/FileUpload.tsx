import React, { useState, useCallback } from 'react';

// Icons
const UploadIcon = () => (
    <svg className="w-6 h-6 mb-2 text-dark-muted group-hover:text-brand-400 transition-colors" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
    </svg>
);

const FileIcon = () => (
    <svg className="w-5 h-5 mr-2 text-emerald-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 20">
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
        className={`group flex flex-col items-center justify-center w-full h-20 border border-dashed rounded-md cursor-pointer transition-all duration-200
                    ${isDragging 
                        ? 'border-brand-500 bg-brand-900/20' 
                        : fileName 
                            ? 'border-emerald-500/30 bg-emerald-900/10'
                            : 'border-dark-surface bg-dark-bg hover:border-brand-500/30 hover:bg-dark-surface/50'}`}>
        {fileName ? (
          <div className="flex items-center px-4 w-full overflow-hidden">
            <FileIcon />
            <span className="font-medium text-xs text-white truncate flex-1">{fileName}</span>
            <span className="text-emerald-400 text-[10px] ml-2 font-bold">OK</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-1 pb-2">
            <UploadIcon />
            <p className="text-[10px] text-dark-muted group-hover:text-white uppercase tracking-wide">{label}</p>
          </div>
        )}
        <input id={`dropzone-file-${label}`} type="file" className="hidden" accept={acceptedTypes} onChange={onFileChange} />
      </label>
    </div>
  );
};

export default FileUpload;