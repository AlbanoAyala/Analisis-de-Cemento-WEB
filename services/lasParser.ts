import { LasData } from '../types.ts';

export function parseLasFile(fileContent: string): LasData {
  const lines = fileContent.split(/\r?\n/);

  let wellName = "Pozo Desconocido";
  let step: number | null = null;
  const curves: string[] = [];
  const data: Record<string, number>[] = [];
  
  let currentSection: 'W' | 'P' | 'C' | 'A' | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue; // Skip empty lines and comments
    }

    // Check for section change
    if (trimmedLine.startsWith('~')) {
      const match = trimmedLine.match(/^~\s*([A-Z])/i);
      if (match) {
        const sectionHeader = match[1].toUpperCase();
        if (['W', 'P', 'C', 'A'].includes(sectionHeader)) {
          currentSection = sectionHeader as 'W' | 'P' | 'C' | 'A';
        } else {
          currentSection = null; // Ignore other sections like ~V
        }
      }
      continue; // Move to the next line after identifying the section
    }

    switch (currentSection) {
      case 'W': // Well Information
        // Regex to capture the data part between "WELL." and the colon ":"
        const wellMatch = trimmedLine.match(/^WELL\s*\.\s*(.*?)\s*:/i);
        if (wellMatch && wellMatch[1] && wellMatch[1].trim()) {
            wellName = wellMatch[1].trim();
        }
        const stepMatch = trimmedLine.match(/^STEP\.?\s+.*\s*:\s*(-?\d*\.?\d*)/i);
        if (stepMatch && stepMatch[1]) {
            step = parseFloat(stepMatch[1]);
        }
        break;
      
      case 'C': // Curve Information
        const curveMnemonic = trimmedLine.split('.')[0].trim().split(/\s+/)[0];
        if (curveMnemonic) {
            curves.push(curveMnemonic);
        }
        break;

      case 'A': // ASCII Log Data
        const values = trimmedLine.split(/\s+/).filter(v => v).map(v => parseFloat(v));
        if (values.length > 0 && values.length === curves.length) {
          const record: Record<string, number> = {};
          curves.forEach((curve, idx) => {
            record[curve] = values[idx];
          });
          data.push(record);
        }
        break;
    }
  }

  if (curves.length === 0 || data.length === 0) {
    throw new Error("Invalid LAS file format: Could not find curve definitions in ~C section or data in ~A section.");
  }
  
  const depthCurve = curves.length > 0 ? curves[0] : 'DEPT';

  // Calculate step from data if not present in header
  if (step === null && data.length > 1 && data[0][depthCurve] !== undefined && data[1][depthCurve] !== undefined) {
      step = Math.abs(data[1][depthCurve] - data[0][depthCurve]);
  }
  
  if (step === null) {
      step = 0.1524;
  }

  const finalCurves = Array.from(new Set(curves));

  return {
    wellName,
    step: Math.abs(step),
    curves: finalCurves,
    data,
    depthCurveName: depthCurve
  };
}