import React, { useState, useCallback, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from './components/Sidebar';
import { parseLasFile } from './services/lasParser';
import { analyzeData } from './services/analysisService';
import { LasData, LayerData, AnalysisResult, Kpi } from './types';
import LogPlot from './components/LogPlot';
import DistributionChart from './components/DistributionChart';
import ReportGenerator from './components/ReportGenerator';

const Header = () => (
    <header className="bg-dark-card p-4 shadow-md">
        <h1 className="text-2xl font-bold text-center text-brand-primary">Cement Quality Control Analyzer</h1>
    </header>
);

const Loader = () => (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="mt-4 text-lg">Analyzing data...</span>
    </div>
);

const KpiCard: React.FC<{ title: string; value: string | number; color?: string; unit?: string }> = ({ title, value, color = 'text-brand-primary', unit = '' }) => (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md text-center">
        <h4 className="text-sm font-medium text-gray-400">{title}</h4>
        <p className={`text-2xl font-bold ${color}`}>{value}{unit}</p>
    </div>
);

const getScoreColor = (score: number | undefined) => {
    if (score === undefined || isNaN(score)) return 'text-gray-400';
    if (score < 75) return 'text-red-500';
    if (score < 85) return 'text-yellow-400';
    if (score < 95) return 'text-lime-400';
    return 'text-green-500';
};

const KpiDashboard: React.FC<{ kpis: Kpi }> = ({ kpis }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard title="Cement Score" value={kpis.Cement_Score?.toFixed(1) ?? 'N/A'} color={getScoreColor(kpis.Cement_Score)} unit="%" />
        <KpiCard title="TOC Found" value={kpis.TOC_Encontrado.toFixed(2)} unit=" m" />
        <KpiCard title="TOC Requested" value={kpis.TOC_Solicitado?.toFixed(2) ?? 'N/A'} unit=" m" />
        <KpiCard title="Good Bond" value={kpis.Good_Bond_Percentage.toFixed(1)} unit=" %" />
        <KpiCard title="Total Cemented" value={kpis.Total_Meters.toFixed(2)} unit=" m" />
    </div>
);

const MenuIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);


const App: React.FC = () => {
    const [lasData, setLasData] = useState<LasData | null>(null);
    const [layersData, setLayersData] = useState<LayerData[] | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    // State for manual chart scaling
    const [amplitudeRange, setAmplitudeRange] = useState({ min: '0', max: '150' });

    const logPlotRef = useRef<HTMLDivElement>(null);
    const distChartRef = useRef<HTMLDivElement>(null);

    const parsedAmplitudeRange = useMemo(() => {
        const min = parseFloat(amplitudeRange.min);
        const max = parseFloat(amplitudeRange.max);
        return {
            min: isNaN(min) ? 0 : min,
            max: isNaN(max) || max < min ? (isNaN(min) ? 150 : min + 1) : max,
        };
    }, [amplitudeRange]);
    
    // A declarative key forces a remount, which is the most robust solution for recharts.
    const logPlotKey = useMemo(() => {
        return `${analysisResult?.wellName}-${parsedAmplitudeRange.min}-${parsedAmplitudeRange.max}`;
    }, [analysisResult, parsedAmplitudeRange]);

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
            setError("Please upload all required files and enter valid requested TOC and Annulus Height values greater than zero.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        setTimeout(() => {
            try {
                const result = analyzeData(lasData, effectiveLayers || [], tocNum, alturaNum);
                setAnalysisResult(result);
                // Reset scale to default on new analysis
                setAmplitudeRange({ min: '0', max: '150' });
            } catch (e: any) {
                setError(`Analysis failed: ${e.message}`);
                setAnalysisResult(null);
            } finally {
                setIsLoading(false);
            }
        }, 500);
    };

    return (
        <div className="min-h-screen bg-dark-bg text-dark-text font-sans">
            <Header />
            <div className="flex">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    onAnalyze={handleAnalyze}
                    onLasFileLoaded={handleLasFile}
                    onExcelFileLoaded={handleExcelFile}
                    hasLasData={!!lasData}
                    hasExcelData={!!layersData}
                />
                <main className={`flex-grow p-4 md:p-8 transition-all duration-300 ${isSidebarOpen ? 'ml-96' : 'ml-0'}`}>
                    {error && <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4" role="alert">{error}</div>}
                    
                    {!isLoading && !analysisResult && !error && (
                         <div className="flex items-center justify-center h-full bg-dark-card rounded-lg p-10 min-h-[80vh]">
                            <p className="text-gray-400 text-lg">Upload files and click 'Analyze Data' to see the results.</p>
                         </div>
                    )}
                    
                    {isLoading && <div className="bg-dark-card rounded-lg p-10 h-[80vh]"><Loader /></div>}

                    {analysisResult && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-200">Analysis for: <span className="text-brand-primary">{analysisResult.wellName}</span></h2>
                            
                            <KpiDashboard kpis={analysisResult.kpis} />

                            <div ref={distChartRef}>
                               <DistributionChart
                                   data={analysisResult.cementedData}
                                   cblCurve={analysisResult.cblCurve}
                                   step={analysisResult.step}
                               />
                            </div>
                            
                            {/* Chart Controls */}
                            <div className="bg-dark-card p-4 rounded-lg shadow-lg">
                                <h3 className="text-lg font-semibold mb-2 text-gray-300">Chart Controls</h3>
                                <div className="flex items-center space-x-4">
                                    <label htmlFor="amplitude-scale" className="text-sm font-medium text-gray-400">Amplitude Scale:</label>
                                    <div className="flex items-center space-x-2">
                                        <div>
                                            <label htmlFor="min-amp" className="block text-xs text-gray-500">Min</label>
                                            <input type="number" id="min-amp" value={amplitudeRange.min} onChange={(e) => setAmplitudeRange(prev => ({...prev, min: e.target.value}))} className="w-24 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white focus:ring-brand-primary focus:border-brand-primary" />
                                        </div>
                                        <div>
                                            <label htmlFor="max-amp" className="block text-xs text-gray-500">Max</label>
                                            <input type="number" id="max-amp" value={amplitudeRange.max} onChange={(e) => setAmplitudeRange(prev => ({...prev, max: e.target.value}))} className="w-24 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white focus:ring-brand-primary focus:border-brand-primary" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div ref={logPlotRef}>
                                <LogPlot 
                                    key={logPlotKey}
                                    logData={analysisResult.logData}
                                    cblCurve={analysisResult.cblCurve}
                                    tocFound={analysisResult.kpis.TOC_Encontrado}
                                    tocRequested={analysisResult.kpis.TOC_Solicitado}
                                    depthCurveName={analysisResult.depthCurveName}
                                    amplitudeRange={parsedAmplitudeRange}
                                />
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                               <div className="bg-dark-card p-4 rounded-lg shadow-lg">
                                    <h3 className="text-lg font-semibold mb-2 text-gray-300">Intervals with Medium/Bad Quality</h3>
                                    <div className="overflow-auto max-h-60">
                                        <table className="w-full text-sm text-left text-gray-400">
                                            <thead className="text-xs text-gray-300 uppercase bg-gray-700 sticky top-0">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3">Quality</th>
                                                    <th scope="col" className="px-6 py-3">Top (m)</th>
                                                    <th scope="col" className="px-6 py-3">Base (m)</th>
                                                    <th scope="col" className="px-6 py-3">Length (m)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analysisResult.intervals.map((item, index) => (
                                                    <tr key={index} className="border-b border-gray-700 hover:bg-gray-800">
                                                        <td className={`px-6 py-2 font-medium ${item.Calidad === 'Malo' ? 'text-red-400' : 'text-yellow-400'}`}>{item.Calidad}</td>
                                                        <td className="px-6 py-2">{item['Tope (m)'].toFixed(2)}</td>
                                                        <td className="px-6 py-2">{item['Base (m)'].toFixed(2)}</td>
                                                        <td className="px-6 py-2">{item['Longitud (m)'].toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                               </div>
                               {analysisResult.layerAnalysis.length > 0 && (
                                <div className="bg-dark-card p-4 rounded-lg shadow-lg">
                                     <h3 className="text-lg font-semibold mb-2 text-gray-300">Adhesion Analysis per Layer</h3>
                                     <div className="overflow-auto max-h-60">
                                         <table className="w-full text-sm text-left text-gray-400">
                                             <thead className="text-xs text-gray-300 uppercase bg-gray-700 sticky top-0">
                                                 <tr>
                                                     <th scope="col" className="px-6 py-3">Layer</th>
                                                     <th scope="col" className="px-6 py-3">Adhesion (%)</th>
                                                     <th scope="col" className="px-6 py-3">Seal Adh. (%)</th>
                                                 </tr>
                                             </thead>
                                             <tbody>
                                                 {analysisResult.layerAnalysis.map((item, index) => (
                                                     <tr key={index} className="border-b border-gray-700 hover:bg-gray-800">
                                                         <td className="px-6 py-2">{item.Capa}</td>
                                                         <td className="px-6 py-2">{item['Adherencia (%)'].toFixed(1)}</td>
                                                         <td className="px-6 py-2">{item['Adherencia Sello (%)'].toFixed(1)}</td>
                                                     </tr>
                                                 ))}
                                             </tbody>
                                         </table>
                                     </div>
                                </div>
                               )}
                            </div>

                            <div className="mt-8">
                                <ReportGenerator
                                    wellName={analysisResult.wellName}
                                    kpis={analysisResult.kpis}
                                    intervals={analysisResult.intervals}
                                    layerAnalysis={analysisResult.layerAnalysis}
                                    logPlotRef={logPlotRef}
                                    distChartRef={distChartRef}
                                    onError={setError}
                                />
                            </div>
                        </div>
                    )}
                </main>
                 {!isSidebarOpen && (
                    <button 
                        onClick={() => setIsSidebarOpen(true)} 
                        className="fixed z-50 top-5 left-5 p-2 bg-dark-card rounded-md text-gray-300 hover:bg-gray-700"
                        aria-label="Open sidebar"
                    >
                        <MenuIcon />
                    </button>
                )}
            </div>
        </div>
    );
};

export default App;