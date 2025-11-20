
import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Kpi, QualityInterval, LayerAnalysisItem } from '../types.ts';

interface ReportGeneratorProps {
  wellName: string;
  kpis: Kpi;
  intervals: QualityInterval[];
  layerAnalysis: LayerAnalysisItem[];
  logPlotRef: React.RefObject<HTMLDivElement>;
  distChartRef: React.RefObject<HTMLDivElement>;
  depthRange: { min: number; max: number };
  onError: (message: string) => void;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ wellName, kpis, intervals, layerAnalysis, logPlotRef, distChartRef, depthRange, onError }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const formatNumber = (num: any, digits = 2) => {
      const n = Number(num);
      return isNaN(n) ? 'N/A' : n.toFixed(digits);
  };
  
  // Helper to draw the CGC Logo directly on PDF to ensure high quality
  const drawHeader = (doc: jsPDF, pageWidth: number) => {
     // Black Box
     doc.setFillColor(0, 0, 0);
     doc.rect(0, 0, 40, 20, 'F');
     
     // CGC Text
     doc.setTextColor(255, 255, 255);
     doc.setFontSize(24);
     doc.setFont("helvetica", "bold");
     doc.text("CGC", 20, 13, { align: 'center' });
     
     // Teal Strip
     doc.setFillColor(0, 155, 155);
     doc.rect(0, 20, 40, 3, 'F');
     
     // Title Text next to logo
     doc.setTextColor(0, 0, 0);
     doc.setFontSize(18);
     doc.text("Quality Control Report", 50, 15);
     
     // Well Info
     doc.setFontSize(10);
     doc.setTextColor(100);
     doc.text(`Well: ${wellName}`, pageWidth - 15, 12, { align: 'right' });
     doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 15, 18, { align: 'right' });
     
     // Horizontal Line
     doc.setDrawColor(200);
     doc.line(15, 28, pageWidth - 15, 28);
  };

  const captureElement = async (element: HTMLElement, scale = 2): Promise<string | null> => {
    if (!element) return null;
    try {
        const canvas = await html2canvas(element, {
            scale: scale,
            backgroundColor: '#1e293b', // Force dark background
            useCORS: true,
            logging: false,
            allowTaint: true,
            height: element.scrollHeight, // Capture full height
            windowHeight: element.scrollHeight + 100,
            onclone: (clonedDoc) => {
                // Force styles in clone if needed
                const clonedEl = clonedDoc.getElementById(element.id || '');
                if (clonedEl) {
                    clonedEl.style.height = 'auto';
                    clonedEl.style.overflow = 'visible';
                }
            }
        });
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error("Capture failed for element", error);
        return null;
    }
  };

  const generatePdf = async () => {
    if(isGenerating) return;
    setIsGenerating(true);
    
    // Capture current state to restore later
    const scrollContainer = logPlotRef.current?.querySelector('.overflow-y-auto') as HTMLElement;
    const chartContainer = scrollContainer?.children[0] as HTMLElement; // The inner div with huge height
    
    const originalWrapperHeight = logPlotRef.current?.style.height;
    const originalScrollHeight = scrollContainer?.style.height;
    const originalOverflow = scrollContainer?.style.overflow;
    const originalChartHeight = chartContainer?.style.height;
    
    try {
        // 1. PREPARE UI FOR CAPTURE
        // We need to fit the ENTIRE depth range into an image.
        // If the log is 3000m long, the div might be 50,000px tall, which crashes html2canvas.
        // Strategy: Force a "Safe Max Height" (e.g. 12000px). 
        // Recharts will effectively "squash" the data into this height, maintaining the full range.
        // 12000px is high enough resolution for a PDF page but safe for canvas.
        
        if (logPlotRef.current && scrollContainer && chartContainer) {
             const realHeight = scrollContainer.scrollHeight;
             // Use the smaller of real height or 12000px to ensure canvas stability
             const safeCaptureHeight = Math.min(Math.max(realHeight, 2000), 12000); 
             
             // Force containers to this safe height
             logPlotRef.current.style.height = `${safeCaptureHeight}px`;
             logPlotRef.current.style.maxHeight = 'none';
             
             scrollContainer.style.height = `${safeCaptureHeight}px`;
             scrollContainer.style.overflow = 'hidden'; // Hide scrollbars
             
             // Force inner chart to fit this height. Recharts will rescale the Y-axis to fit.
             chartContainer.style.height = `${safeCaptureHeight}px`;
        }

        // Wait for Recharts to re-render/animation to finish in the resized view
        // A bit longer wait to ensure large datasets render fully
        await new Promise(resolve => setTimeout(resolve, 3500));

        // 2. CREATE PDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        
        drawHeader(doc, pageWidth);
        let lastY = 35;

        // --- KPIs ---
        doc.setFontSize(12);
        doc.setTextColor(0, 155, 155); // Teal
        doc.setFont("helvetica", "bold");
        doc.text("Key Performance Indicators", margin, lastY);
        lastY += 8;

        const kpiData = [
            ["Cement Score", formatNumber(kpis.Cement_Score, 1)],
            ["TOC Found", formatNumber(kpis.TOC_Encontrado) + " m"],
            ["Good Bond (<10mV)", formatNumber(kpis.Good_Bond_Percentage, 1) + " %"],
            ["Total Analyzed", formatNumber(kpis.Total_Meters, 0) + " m"],
        ];

        autoTable(doc, {
            startY: lastY,
            head: [['Metric', 'Value']],
            body: kpiData,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: 255 }, // Dark Slate
            styles: { fontSize: 10, textColor: 50 },
            columnStyles: { 0: { fontStyle: 'bold' } }
        });
        lastY = (doc as any).lastAutoTable.finalY + 15;

        // --- Distribution Chart ---
        if (distChartRef.current) {
            doc.setFontSize(12);
            doc.setTextColor(0, 155, 155);
            doc.text("Amplitude Distribution", margin, lastY);
            lastY += 5;
            
            const distPng = await captureElement(distChartRef.current);
            if (distPng) {
                 const imgProps = doc.getImageProperties(distPng);
                 const pdfImgWidth = pageWidth - (margin * 2);
                 const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;
                 
                 if (lastY + pdfImgHeight > pageHeight - 20) {
                     doc.addPage();
                     drawHeader(doc, pageWidth);
                     lastY = 35;
                 }
                 
                 doc.addImage(distPng, 'PNG', margin, lastY, pdfImgWidth, pdfImgHeight);
                 lastY += pdfImgHeight + 15;
            }
        }

        // --- Intervals ---
        if (lastY + 40 > pageHeight) { doc.addPage(); drawHeader(doc, pageWidth); lastY = 35; }
        doc.setFontSize(12);
        doc.setTextColor(0, 155, 155);
        doc.text("Critical Intervals (Medium/Poor Bond)", margin, lastY);
        
        const intervalBody = intervals.map(i => [
            i.Calidad,
            formatNumber(i['Tope (m)']),
            formatNumber(i['Base (m)']),
            formatNumber(i['Longitud (m)'])
        ]);

        autoTable(doc, {
            startY: lastY + 6,
            head: [['Quality', 'Top (m)', 'Base (m)', 'Length (m)']],
            body: intervalBody,
            theme: 'striped',
            headStyles: { fillColor: [100, 116, 139] }, 
        });
        lastY = (doc as any).lastAutoTable.finalY + 15;

        // --- Layer Analysis (NEW SECTION) ---
        if (layerAnalysis && layerAnalysis.length > 0) {
            if (lastY + 40 > pageHeight) { doc.addPage(); drawHeader(doc, pageWidth); lastY = 35; }
            
            doc.setFontSize(12);
            doc.setTextColor(0, 155, 155);
            doc.text("Analysis by Layers", margin, lastY);
            
            const layerBody = layerAnalysis.map(l => [
                l.Capa,
                formatNumber(l['Tope (m)']),
                formatNumber(l['Base (m)']),
                formatNumber(l['Adherencia (%)']),
                formatNumber(l['Adherencia Sello (%)'])
            ]);

            autoTable(doc, {
                startY: lastY + 6,
                head: [['Layer', 'Top (m)', 'Base (m)', 'Bond %', 'Seal %']],
                body: layerBody,
                theme: 'striped',
                headStyles: { fillColor: [0, 155, 155] }, // Teal header for layers
            });
        }
        
        // --- Log Plot (Single Page Force) ---
        // Always put log plot on a new page
        if (logPlotRef.current) {
            doc.addPage();
            drawHeader(doc, pageWidth);
            lastY = 35; // Header height
            
            doc.setFontSize(12);
            doc.setTextColor(0, 155, 155);
            
            // Use the manually selected range for the title
            const rangeLabel = depthRange 
                ? `(${depthRange.min}m - ${depthRange.max}m)` 
                : '(Full Interval)';
            doc.text(`Cement Bond Log ${rangeLabel}`, margin, lastY);
            lastY += 5; // Space for image start
            
            // Use lower scale (1.5) if it's huge to save memory, otherwise 2 for quality
            const captureScale = 2;
            const logPng = await captureElement(logPlotRef.current, captureScale); 
            
            if (logPng) {
                const imgProps = doc.getImageProperties(logPng);
                
                // Available space on the single page
                const availableWidth = pageWidth - (margin * 2);
                const availableHeight = pageHeight - lastY - margin;
                
                // We ignore aspect ratio preservation for HEIGHT if it exceeds the page.
                // We want to FIT the whole log into availableHeight.
                // Since we captured the "whole log" in the image (thanks to resizing above),
                // we just need to fit that image into the box.
                
                const widthRatio = availableWidth / imgProps.width;
                const heightRatio = availableHeight / imgProps.height;
                
                // Use the smaller ratio to ensure it fits both dimensions completely
                const scaleFactor = Math.min(widthRatio, heightRatio);
                
                const finalWidth = imgProps.width * scaleFactor;
                const finalHeight = imgProps.height * scaleFactor;
                
                // Center horizontally
                const xOffset = margin + (availableWidth - finalWidth) / 2;

                doc.addImage(logPng, 'PNG', xOffset, lastY, finalWidth, finalHeight);
            }
        }

        doc.save(`CGC_Report_${wellName.replace(/\s+/g, '_')}.pdf`);

    } catch (err: any) {
        console.error("PDF Generation Error:", err);
        onError("Error generando PDF. Intente nuevamente.");
    } finally {
        // 3. RESTORE UI
        if (logPlotRef.current && scrollContainer && chartContainer) {
            logPlotRef.current.style.height = originalWrapperHeight || '100%';
            logPlotRef.current.style.maxHeight = '';
            
            scrollContainer.style.height = originalScrollHeight || '100%';
            scrollContainer.style.overflow = originalOverflow || 'auto';
            
            chartContainer.style.height = originalChartHeight || '100%';
        }
        setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePdf}
      disabled={isGenerating}
      className={`w-full font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-lg
        ${isGenerating 
            ? 'bg-dark-surface text-dark-muted cursor-wait' 
            : 'bg-brand-600 text-white hover:bg-brand-500 hover:-translate-y-0.5 shadow-brand-900/20'
        }`}
    >
      {isGenerating ? (
          <>
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            <span>Generando Reporte...</span>
          </>
      ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span>Descargar Reporte PDF</span>
          </>
      )}
    </button>
  );
};

export default ReportGenerator;
