import React, { useState } from 'react';
import FileUpload from './FileUpload';

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    onAnalyze: (toc: string, annulus: string, analyzeWithLayers: boolean) => void;
    onLasFileLoaded: (content: string | ArrayBuffer) => void;
    onExcelFileLoaded: (content: string | ArrayBuffer) => void;
    hasLasData: boolean;
    hasExcelData: boolean;
}

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const Logo = () => (
    <div className="mt-8">
        <div className="w-24 h-24 mx-auto rounded-md overflow-hidden shadow-lg">
            <div className="h-1/2 bg-black flex items-center justify-center">
                <span className="text-white text-4xl font-sans font-bold tracking-widest">CGC</span>
            </div>
            <div className="h-1/2 bg-teal-600"></div>
        </div>
    </div>
);


const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onAnalyze, onLasFileLoaded, onExcelFileLoaded, hasLasData, hasExcelData }) => {
    const [tocSolicitado, setTocSolicitado] = useState<string>('');
    const [alturaAnillo, setAlturaAnillo] = useState<string>('');
    const [analyzeWithLayers, setAnalyzeWithLayers] = useState(true);

    const tocNum = parseFloat(tocSolicitado);
    const alturaNum = parseFloat(alturaAnillo);
    const isAnalyzeDisabled = !hasLasData || 
                              (analyzeWithLayers && !hasExcelData) || 
                              isNaN(tocNum) || tocNum <= 0 || 
                              isNaN(alturaNum) || alturaNum <= 0;

    const handleAnalyzeClick = () => {
        onAnalyze(tocSolicitado, alturaAnillo, analyzeWithLayers);
    };

    return (
        <aside className={`fixed top-0 left-0 z-40 w-96 h-screen bg-dark-card shadow-lg transition-transform duration-300
                         ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="h-full px-6 py-4 overflow-y-auto flex flex-col">
                <div className="flex-grow">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-300 border-b border-gray-700 pb-2 flex-grow">Controls</h2>
                        <button onClick={onToggle} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md">
                            <CloseIcon />
                        </button>
                    </div>
                    <div className="space-y-6">
                        <FileUpload onFileLoaded={onLasFileLoaded} acceptedTypes=".las" label="1. Upload .las file" />
                        
                        <div className="flex items-center justify-between p-2 rounded-md bg-gray-800">
                            <label htmlFor="layer-toggle" className="text-sm font-medium text-gray-400">Analyze with Formation Layers</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="layer-toggle" className="sr-only peer" checked={analyzeWithLayers} onChange={() => setAnalyzeWithLayers(!analyzeWithLayers)} />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-brand-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                            </label>
                        </div>

                        {analyzeWithLayers && (
                          <FileUpload onFileLoaded={onExcelFileLoaded} acceptedTypes=".xlsx, .xls" label="2. Upload layers Excel" isBinary={true} />
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Required: Requested TOC (m)</label>
                            <input type="number" value={tocSolicitado} onChange={e => setTocSolicitado(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-brand-primary focus:border-brand-primary"
                                placeholder="e.g., 1500.50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Required: Requested Annulus Height (m)</label>
                            <input type="number" value={alturaAnillo} onChange={e => setAlturaAnillo(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-brand-primary focus:border-brand-primary"
                                placeholder="e.g., 300"
                            />
                        </div>
                        
                        <button onClick={handleAnalyzeClick} disabled={isAnalyzeDisabled}
                            className={`w-full text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out
                                        ${isAnalyzeDisabled ? 'bg-gray-600 cursor-not-allowed' : 'bg-brand-primary hover:bg-brand-secondary'}`}>
                            Analyze Data
                        </button>
                    </div>
                </div>
                <Logo />
            </div>
        </aside>
    );
};

export default Sidebar;