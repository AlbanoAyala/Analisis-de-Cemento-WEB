import React from 'react';
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
  onError: (message: string) => void;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ wellName, kpis, intervals, layerAnalysis, logPlotRef, distChartRef, onError }) => {
  
  const formatNumber = (num: any, digits = 2) => {
      const n = Number(num);
      return isNaN(n) ? 'N/A' : n.toFixed(digits);
  };
  
  const captureChartAsPng = (elementRef: React.RefObject<HTMLDivElement>): Promise<string | null> => {
    return new Promise((resolve) => {
        const element = elementRef.current;
        if (!element) {
            console.warn("PDF generation: element ref for chart is null.");
            return resolve(null);
        }

        html2canvas(element, {
            scale: 3,
            backgroundColor: '#1A1A1A',
            useCORS: true,
            logging: false,
        }).then(canvas => {
            resolve(canvas.toDataURL('image/png'));
        }).catch(error => {
            console.error("html2canvas failed to capture chart:", error);
            resolve(null);
        });
    });
  };

  const generatePdf = () => {
    setTimeout(async () => {
        try {
          const doc = new jsPDF();
          
          doc.text(`Cementation Analysis Report for: ${wellName}`, 14, 20);
          
          let lastY = 30;

          // 1. KPIs
          const kpiData = Object.entries(kpis)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => {
              const formattedKey = key.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, a => a.toUpperCase());
              const digits = key.includes('Percentage') || key.includes('Score') || key.includes('Evaluacion') ? 1 : 2;
              return [formattedKey, formatNumber(value, digits)];
            });

          if (kpiData.length > 0) {
            autoTable(doc, {
              startY: lastY,
              head: [['KPI', 'Value']],
              body: kpiData,
              theme: 'striped',
              headStyles: { fillColor: [30, 144, 255] },
            });
            const tableEnd = (doc as any).lastAutoTable.finalY;
            lastY = (typeof tableEnd === 'number' && !isNaN(tableEnd)) ? tableEnd + 10 : lastY + 80;
          }
          
          // Capture charts first
          const logPlotPng = await captureChartAsPng(logPlotRef);
          const distChartPng = await captureChartAsPng(distChartRef);

          // Helper to add images, with centering option
          const addImageToPdf = (pngUrl: string | null, elementRef: React.RefObject<HTMLDivElement>, centered = false) => {
            if (!pngUrl || !elementRef.current) return;
            
            const { clientWidth: elementWidth, clientHeight: elementHeight } = elementRef.current;
            if (elementWidth === 0 || elementHeight === 0) {
              console.warn('Skipping image in PDF because element has zero dimensions.');
              return;
            }

            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;
            const pdfWidth = pageWidth - (margin * 2);
            const pdfHeight = (elementHeight * pdfWidth) / elementWidth;
            
            if (lastY + pdfHeight > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              lastY = 20;
            }

            const xPosition = centered ? (pageWidth - pdfWidth) / 2 : margin;
            
            doc.addImage(pngUrl, 'PNG', Math.round(xPosition), Math.round(lastY), Math.round(pdfWidth), Math.round(pdfHeight));
            lastY += pdfHeight + 10;
          }

          // 2. Distribution Chart (centered)
          addImageToPdf(distChartPng, distChartRef, true);

          // Helper to add tables
          const addTableToPdf = (title: string, head: string[][], body: any[][]) => {
              if (body.length === 0) return;
              const estimatedHeight = (body.length + 1) * 8 + 15;
              if (lastY + estimatedHeight > doc.internal.pageSize.getHeight() - 20) {
                  doc.addPage();
                  lastY = 20;
              }
              doc.text(title, 14, lastY);
              autoTable(doc, {
                  startY: lastY + 5,
                  head,
                  body,
                  theme: 'grid',
                  headStyles: { fillColor: [30, 144, 255] },
              });
              const tableEnd = (doc as any).lastAutoTable.finalY;
              lastY = (typeof tableEnd === 'number' && !isNaN(tableEnd)) ? tableEnd + 10 : lastY + estimatedHeight;
          };

          // 3. Data Tables
          addTableToPdf(
              "Intervals with Medium/Bad Quality",
              [['Quality', 'Top (m)', 'Base (m)', 'Length (m)']],
              intervals.map(i => [i.Calidad, formatNumber(i['Tope (m)']), formatNumber(i['Base (m)']), formatNumber(i['Longitud (m)'])])
          );

          if(layerAnalysis.length > 0) {
            addTableToPdf(
                "Adhesion Analysis per Layer",
                [['Layer', 'Top (m)', 'Base (m)', 'Adhesion (%)', 'Seal Adhesion (%)']],
                layerAnalysis.map(l => [l.Capa, formatNumber(l['Tope (m)']), formatNumber(l['Base (m)']), formatNumber(l['Adherencia (%)'], 1), formatNumber(l['Adherencia Sello (%)'], 1)])
            );
          }

          // 4. Main Log Plot
          addImageToPdf(logPlotPng, logPlotRef, false);

          doc.save(`Report_CBL_${wellName}.pdf`);
        } catch (err) {
          console.error("PDF Generation failed:", err);
          onError("Failed to generate PDF report. There might be an issue with chart rendering. Please see browser console for details.");
        }
    }, 200);
  };

  return (
    <button
      onClick={generatePdf}
      className="w-full bg-brand-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-brand-secondary transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-brand-primary"
    >
      Download PDF Report
    </button>
  );
};

export default ReportGenerator;