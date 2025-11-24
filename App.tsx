
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from './components/Sidebar';
import { parseLasFile } from './services/lasParser';
import { analyzeData } from './services/analysisService';
import { LasData, LayerData, AnalysisResult, Kpi } from './types';
import LogPlot from './components/LogPlot';
import DistributionChart from './components/DistributionChart';
import ReportGenerator from './components/ReportGenerator';

// -- Components UI --

const Header = ({ toggleSidebar, wellName }: { toggleSidebar: () => void, wellName?: string }) => (
    <header className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-4 shadow-md shrink-0 z-20 relative">
        <div className="flex items-center gap-4">
            <button 
                onClick={toggleSidebar} 
                className="p-2 text-dark-muted hover:text-white hover:bg-dark-surface rounded-lg transition-colors lg:hidden"
                aria-label="Toggle sidebar"
            >
                <MenuIcon />
            </button>
            
            <div className="flex flex-col justify-center">
                <h1 className="text-sm font-bold text-brand-400 tracking-wider uppercase">
                    CGC <span className="text-dark-muted font-normal mx-1">|</span> Quality Control
                </h1>
            </div>
        </div>

        {wellName && (
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-dark-bg/50 px-4 py-1 rounded-full border border-dark-border/50 hidden md:flex">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-sm font-medium text-white tracking-wide">{wellName}</span>
            </div>
        )}

        {/* Empty div to balance flex layout if needed, or just nothing */}
        <div className="w-6"></div>
    </header>
);

const Loader = () => (
    <div className="flex flex-col items-center justify-center h-full text-dark-muted animate-pulse">
        <div className="relative w-16 h-16 mb-4">
             <div className="absolute top-0 left-0 w-full h-full border-4 border-dark-surface rounded-full"></div>
             <div className="absolute top-0 left-0 w-full h-full border-4 border-brand-500 rounded-full animate-spin border-t-transparent"></div>
        </div>
        <span className="text-sm font-medium tracking-widest uppercase text-brand-400">Procesando Datos...</span>
    </div>
);

const KpiCard: React.FC<{ title: string; value: string | number; color?: string; unit?: string; subtext?: string }> = ({ title, value, color = 'text-white', unit = '', subtext }) => (
    <div className="bg-dark-card border border-dark-surface rounded-lg p-3 flex flex-col justify-between relative overflow-hidden group h-24">
        <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"></path><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"></path></svg>
        </div>
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-dark-muted mb-1">{title}</h4>
        <div className="flex items-baseline gap-1 z-10">
            <span className={`text-2xl font-bold tracking-tight ${color}`}>{value}</span>
            {unit && <span className="text-xs text-dark-muted font-medium">{unit}</span>}
        </div>
        {subtext && <p className="text-[10px] text-dark-muted mt-auto truncate">{subtext}</p>}
    </div>
);

const getScoreColor = (score: number | undefined) => {
    if (score === undefined || isNaN(score)) return 'text-dark-muted';
    if (score < 75) return 'text-red-500';
    if (score < 85) return 'text-yellow-400';
    if (score < 95) return 'text-lime-400';
    return 'text-emerald-400';
};

const MenuIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

// -- Main Application --

const App: React.FC = () => {
    const [lasData, setLasData] = useState<LasData | null>(null);
    const [layersData, setLayersData] = useState<LayerData[] | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // State for manual chart scaling
    const [amplitudeRange, setAmplitudeRange] = useState({ min: '0', max: '100' });
    const [depthRange, setDepthRange] = useState({ min: '0', max: '3000' });

    const logPlotRef = useRef<HTMLDivElement>(null);
    const distChartRef = useRef<HTMLDivElement>(null);

    const parsedAmplitudeRange = useMemo(() => {
        const min = parseFloat(amplitudeRange.min);
        const max = parseFloat(amplitudeRange.max);
        const safeMin = isNaN(min) || min < 0 ? 0 : min;
        return {
            min: safeMin,
            max: isNaN(max) || max <= safeMin ? safeMin + 10 : max,
        };
    }, [amplitudeRange]);

    const parsedDepthRange = useMemo(() => {
        const min = parseFloat(depthRange.min);
        const max = parseFloat(depthRange.max);
        const safeMin = isNaN(min) || min < 0 ? 0 : min;
        return {
            min: safeMin,
            max: isNaN(max) || max <= safeMin ? (isNaN(min) ? 3000 : safeMin + 100) : max,
        };
    }, [depthRange]);
    
    // Reset scales when new analysis comes in
    useEffect(() => {
        if (analysisResult && analysisResult.logData.length > 0) {
            const depths = analysisResult.logData.map(d => d[analysisResult.depthCurveName]);
            const minDepth = Math.max(0, Math.min(...depths)); // Ensure min is at least 0
            const maxDepth = Math.max(...depths);
            setDepthRange({
                min: Math.floor(minDepth).toString(),
                max: Math.ceil(maxDepth).toString()
            });
            setAmplitudeRange({ min: '0', max: '100' });
        }
    }, [analysisResult]);
    
    const logPlotKey = useMemo(() => {
        // Force re-render when ranges change significantly
        return `${analysisResult?.wellName}-${parsedAmplitudeRange.min}-${parsedAmplitudeRange.max}-${parsedDepthRange.min}-${parsedDepthRange.max}`;
    }, [analysisResult, parsedAmplitudeRange, parsedDepthRange]);


    const handleLasFile = useCallback((content: string | ArrayBuffer) => {
        try {
            if (typeof content === 'string') {
                const parsed = parseLasFile(content);
                setLasData(parsed);
                setError(null);
            }
        } catch (e: any) {
            setError(`Error parsing .las file: ${e.message}`);
            setLasData(null);
        }
    }, []);

    const handleExcelFile = useCallback((content: string | ArrayBuffer) => {
        try {
            const workbook = XLSX.read(content, { type: 'array' });
            const sheetName = 'Capas';
            if (!workbook.SheetNames.includes(sheetName)) {
                throw new Error(`Sheet "${sheetName}" not found in the Excel file.`);
            }
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            const layers = json.slice(1).map(row => ({
                wellName: row[0],
                top: parseFloat(row[1]),
                base: parseFloat(row[2])
            })).filter(layer => !isNaN(layer.top) && !isNaN(layer.base) && layer.base > layer.top);
            
            setLayersData(layers);
            setError(null);
        } catch (e: any) {
            setError(`Error parsing Excel file: ${e.message}`);
            setLayersData(null);
        }
    }, []);

    const handleAnalyze = (toc: string, annulus: string, analyzeWithLayers: boolean) => {
        const tocNum = parseFloat(toc);
        const alturaNum = parseFloat(annulus);
        const effectiveLayers = analyzeWithLayers ? layersData : [];

        if (!lasData || (analyzeWithLayers && !layersData) || isNaN(tocNum) || tocNum <= 0 || isNaN(alturaNum) || alturaNum <= 0) {
            setError("Por favor verifique que los archivos y parámetros sean correctos.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setIsSidebarOpen(false);

        setTimeout(() => {
            try {
                const result = analyzeData(lasData, effectiveLayers || [], tocNum, alturaNum);
                setAnalysisResult(result);
            } catch (e: any) {
                setError(`Analysis failed: ${e.message}`);
                setAnalysisResult(null);
            } finally {
                setIsLoading(false);
            }
        }, 600);
    };

    return (
        <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-dark-bg text-dark-text font-sans">
            
            <Sidebar
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                onAnalyze={handleAnalyze}
                onLasFileLoaded={handleLasFile}
                onExcelFileLoaded={handleExcelFile}
                hasLasData={!!lasData}
                hasExcelData={!!layersData}
            />

            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" 
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0 h-full lg:ml-72 transition-all duration-300">
                <Header toggleSidebar={() => setIsSidebarOpen(true)} wellName={analysisResult?.wellName} />

                <main className="flex-1 overflow-hidden p-2 lg:p-4 relative">
                    {error && (
                        <div className="absolute top-4 left-4 right-4 z-50 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 backdrop-blur-md" role="alert">
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                            {error}
                        </div>
                    )}
                    
                    {!isLoading && !analysisResult && !error && (
                         <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-dark-surface rounded-xl bg-dark-card/20">
                            <div className="bg-dark-surface/50 p-6 rounded-full mb-4">
                                <svg className="w-12 h-12 text-brand-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <h3 className="text-xl font-medium text-white">Sin Datos de Análisis</h3>
                            <p className="text-dark-muted max-w-md text-center mt-2 text-sm">Cargue un archivo .LAS y configure los parámetros en el menú lateral para comenzar.</p>
                         </div>
                    )}
                    
                    {isLoading && <Loader />}

                    {analysisResult && (
                        <div className="h-full flex flex-col lg:flex-row gap-4">
                            
                            {/* Left Panel: Log Plot (Vertical Focus) */}
                            <div className="lg:w-1/3 xl:w-1/4 flex flex-col gap-2 h-full">
                                <div className="bg-dark-card rounded-lg shadow-lg border border-dark-surface flex flex-col h-full overflow-hidden">
                                    
                                    {/* Chart Controls Header */}
                                    <div className="p-3 border-b border-dark-surface bg-dark-bg/50 backdrop-blur flex flex-col gap-3 shrink-0">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-bold text-xs text-brand-400 uppercase tracking-wider flex items-center gap-2">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                                Cement Bond Log
                                            </h3>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Amplitude Scale Control */}
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] text-dark-muted uppercase font-semibold">Amplitude (mV)</span>
                                                <div className="flex items-center gap-1 bg-dark-bg rounded border border-dark-surface p-0.5">
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        value={amplitudeRange.min} 
                                                        onChange={(e) => setAmplitudeRange(prev => ({...prev, min: e.target.value}))} 
                                                        className="w-full bg-transparent text-[10px] text-white text-center focus:outline-none"
                                                    />
                                                    <span className="text-dark-muted text-[9px]">-</span>
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        value={amplitudeRange.max} 
                                                        onChange={(e) => setAmplitudeRange(prev => ({...prev, max: e.target.value}))} 
                                                        className="w-full bg-transparent text-[10px] text-white text-center focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* Depth Scale Control */}
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] text-dark-muted uppercase font-semibold">Depth (m)</span>
                                                <div className="flex items-center gap-1 bg-dark-bg rounded border border-dark-surface p-0.5">
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        value={depthRange.min} 
                                                        onChange={(e) => setDepthRange(prev => ({...prev, min: e.target.value}))} 
                                                        className="w-full bg-transparent text-[10px] text-white text-center focus:outline-none"
                                                    />
                                                    <span className="text-dark-muted text-[9px]">-</span>
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        value={depthRange.max} 
                                                        onChange={(e) => setDepthRange(prev => ({...prev, max: e.target.value}))} 
                                                        className="w-full bg-transparent text-[10px] text-white text-center focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 relative w-full min-h-0" ref={logPlotRef}>
                                        <LogPlot 
                                            key={logPlotKey}
                                            logData={analysisResult.logData}
                                            cblCurve={analysisResult.cblCurve}
                                            tocFound={analysisResult.kpis.TOC_Encontrado}
                                            tocRequested={analysisResult.kpis.TOC_Solicitado}
                                            depthCurveName={analysisResult.depthCurveName}
                                            amplitudeRange={parsedAmplitudeRange}
                                            depthRange={parsedDepthRange}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Dashboard (Scrollable) */}
                            <div className="lg:w-2/3 xl:w-3/4 flex flex-col gap-4 h-full min-h-0 overflow-y-auto custom-scrollbar pr-1">
                                
                                {/* KPI Row */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                                    <KpiCard title="Cement Score" value={analysisResult.kpis.Cement_Score?.toFixed(1) ?? 'N/A'} color={getScoreColor(analysisResult.kpis.Cement_Score)} unit="%" subtext="Calidad Global" />
                                    <KpiCard title="TOC Encontrado" value={analysisResult.kpis.TOC_Encontrado.toFixed(1)} unit="m" color="text-red-500" />
                                    <KpiCard title="TOC Solicitado" value={analysisResult.kpis.TOC_Solicitado?.toFixed(1) ?? 'N/A'} unit="m" color="text-indigo-400" />
                                    <KpiCard title="Adherencia" value={analysisResult.kpis.Good_Bond_Percentage.toFixed(1)} unit="%" color="text-emerald-400" subtext="Metros Buenos" />
                                </div>

                                {/* Charts & Tables */}
                                <div className="flex-1 flex flex-col gap-4">
                                    {/* Distribution */}
                                    <div ref={distChartRef} className="w-full bg-dark-card rounded-lg border border-dark-surface overflow-hidden shrink-0">
                                        <DistributionChart
                                            data={analysisResult.cementedData}
                                            cblCurve={analysisResult.cblCurve}
                                            step={analysisResult.step}
                                        />
                                    </div>

                                    {/* Tables Container */}
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-4">
                                        {/* Intervals Table */}
                                        <div className="bg-dark-card rounded-lg border border-dark-surface overflow-hidden flex flex-col h-80 shadow-lg">
                                            <div className="p-3 border-b border-dark-surface bg-dark-bg/30">
                                                <h3 className="font-bold text-xs text-dark-text uppercase">Intervalos Críticos</h3>
                                            </div>
                                            <div className="overflow-y-auto flex-1 custom-scrollbar">
                                                <table className="w-full text-xs text-left text-dark-muted">
                                                    <thead className="text-[10px] text-dark-text uppercase bg-dark-surface/50 sticky top-0 z-10">
                                                        <tr>
                                                            <th className="px-3 py-2">Calidad</th>
                                                            <th className="px-3 py-2 font-mono text-right">Tope (m)</th>
                                                            <th className="px-3 py-2 font-mono text-right">Base (m)</th>
                                                            <th className="px-3 py-2 font-mono text-right">Long (m)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-dark-surface/50">
                                                        {analysisResult.intervals.map((item, index) => (
                                                            <tr key={index} className="hover:bg-dark-surface/20">
                                                                <td className="px-3 py-1.5">
                                                                    <span className={`inline-block px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold border ${item.Calidad === 'Malo' ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-yellow-900/20 text-yellow-400 border-yellow-900/30'}`}>
                                                                        {item.Calidad}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-1.5 font-mono text-right text-dark-text">{item['Tope (m)'].toFixed(2)}</td>
                                                                <td className="px-3 py-1.5 font-mono text-right text-dark-text">{item['Base (m)'].toFixed(2)}</td>
                                                                <td className="px-3 py-1.5 font-mono text-right">{item['Longitud (m)'].toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Layers Table */}
                                        {analysisResult.layerAnalysis.length > 0 && (
                                            <div className="bg-dark-card rounded-lg border border-dark-surface overflow-hidden flex flex-col h-80 shadow-lg">
                                                <div className="p-3 border-b border-dark-surface bg-dark-bg/30">
                                                    <h3 className="font-bold text-xs text-dark-text uppercase">Análisis por Capas</h3>
                                                </div>
                                                <div className="overflow-y-auto flex-1 custom-scrollbar">
                                                    <table className="w-full text-xs text-left text-dark-muted">
                                                        <thead className="text-[10px] text-dark-text uppercase bg-dark-surface/50 sticky top-0 z-10">
                                                            <tr>
                                                                <th className="px-3 py-2">Capa</th>
                                                                <th className="px-3 py-2 font-mono text-right">Tope (m)</th>
                                                                <th className="px-3 py-2 font-mono text-right">Base (m)</th>
                                                                <th className="px-3 py-2 font-mono text-right">Adh %</th>
                                                                <th className="px-3 py-2 font-mono text-right">Sello %</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-dark-surface/50">
                                                            {analysisResult.layerAnalysis.map((item, index) => (
                                                                <tr key={index} className="hover:bg-dark-surface/20">
                                                                    <td className="px-3 py-1.5 font-medium text-white">{item.Capa}</td>
                                                                    <td className="px-3 py-1.5 text-right font-mono text-dark-muted">{item['Tope (m)'].toFixed(1)}</td>
                                                                    <td className="px-3 py-1.5 text-right font-mono text-dark-muted">{item['Base (m)'].toFixed(1)}</td>
                                                                    <td className="px-3 py-1.5 text-right font-mono text-white">{item['Adherencia (%)'].toFixed(1)}</td>
                                                                    <td className="px-3 py-1.5 text-right font-mono text-white">{item['Adherencia Sello (%)'].toFixed(1)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="pb-6">
                                         <ReportGenerator
                                            wellName={analysisResult.wellName}
                                            kpis={analysisResult.kpis}
                                            intervals={analysisResult.intervals}
                                            layerAnalysis={analysisResult.layerAnalysis}
                                            logPlotRef={logPlotRef}
                                            distChartRef={distChartRef}
                                            depthRange={parsedDepthRange}
                                            onError={setError}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
