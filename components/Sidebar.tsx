
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
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
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

    return (
        <aside 
            className={`fixed inset-y-0 left-0 z-40 w-72 bg-dark-card border-r border-dark-surface transform transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-2xl flex flex-col
                        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                
                {/* Mobile Header */}
                <div className="flex items-center justify-between p-4 lg:hidden border-b border-dark-surface shrink-0">
                    <div className="flex flex-col w-20">
                        <div className="bg-black text-white text-xl font-black flex items-center justify-center py-1 tracking-widest">
                            CGC
                        </div>
                        <div className="h-2 bg-[#009b9b] w-full"></div>
                    </div>
                    <button onClick={onToggle} className="text-dark-muted hover:text-white">
                        <CloseIcon />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
                    
                    {/* Section 1: Files */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-full bg-brand-900/50 flex items-center justify-center text-brand-400 font-bold text-xs border border-brand-500/30">1</div>
                            <h3 className="text-xs font-bold text-dark-text uppercase tracking-wider">Archivos</h3>
                        </div>
                        
                        <div className="space-y-4 pl-2 border-l border-dark-surface ml-3">
                            <div className="pl-4">
                                <label className="text-xs text-dark-muted block mb-2">Registro LAS</label>
                                <FileUpload onFileLoaded={onLasFileLoaded} acceptedTypes=".las" label="Arrastrar archivo .LAS" />
                                {hasLasData && <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Cargado correctamente</p>}
                            </div>

                            <div className="pl-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs text-dark-muted">Capas (Excel)</label>
                                    <input 
                                        type="checkbox" 
                                        checked={analyzeWithLayers} 
                                        onChange={() => setAnalyzeWithLayers(!analyzeWithLayers)}
                                        className="w-3 h-3 rounded border-dark-border bg-dark-bg text-brand-500 focus:ring-0 focus:ring-offset-0"
                                    />
                                </div>
                                {analyzeWithLayers && (
                                    <div className="animate-fade-in">
                                        <FileUpload onFileLoaded={onExcelFileLoaded} acceptedTypes=".xlsx, .xls" label="Arrastrar Excel" isBinary={true} />
                                        {hasExcelData && <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Cargado correctamente</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Params */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-full bg-brand-900/50 flex items-center justify-center text-brand-400 font-bold text-xs border border-brand-500/30">2</div>
                            <h3 className="text-xs font-bold text-dark-text uppercase tracking-wider">Parámetros</h3>
                        </div>

                        <div className="space-y-4 pl-2 border-l border-dark-surface ml-3">
                            <div className="pl-4 space-y-4">
                                <div>
                                    <label className="block text-xs text-dark-muted mb-1">TOC Solicitado (m)</label>
                                    <input 
                                        type="number" 
                                        value={tocSolicitado} 
                                        onChange={e => setTocSolicitado(e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-surface rounded-md px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none transition-colors"
                                        placeholder="Ej: 1500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-dark-muted mb-1">Altura Anillo (m)</label>
                                    <input 
                                        type="number" 
                                        value={alturaAnillo} 
                                        onChange={e => setAlturaAnillo(e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-surface rounded-md px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none transition-colors"
                                        placeholder="Ej: 500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Action */}
                <div className="p-5 pb-6 border-t border-dark-surface bg-dark-bg/30 shrink-0 flex flex-col gap-6">
                    <button onClick={() => onAnalyze(tocSolicitado, alturaAnillo, analyzeWithLayers)} disabled={isAnalyzeDisabled}
                        className={`w-full font-bold py-3 px-4 rounded-lg shadow-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm uppercase tracking-wide
                                    ${isAnalyzeDisabled 
                                        ? 'bg-dark-surface text-dark-muted cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400 hover:-translate-y-0.5 shadow-brand-900/20'}`}>
                        <span>Ejecutar Análisis</span>
                    </button>

                    <div className="text-center flex flex-col items-center gap-1">
                        <p className="text-[10px] text-dark-muted/60 uppercase font-medium">Creado por</p>
                        <p className="text-xs text-dark-muted font-bold tracking-wide">CGC Ingenieria Perforación</p>
                        <span className="text-[9px] font-mono text-dark-surface mt-1 border border-dark-surface/50 px-1.5 py-0.5 rounded">v1.3.1</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
