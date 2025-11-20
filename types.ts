
export interface LasData {
  wellName: string;
  step: number;
  curves: string[];
  data: Record<string, number>[];
  depthCurveName: string;
}

export interface LayerData {
  wellName: string;
  top: number;
  base: number;
}

export interface AnalysisResult {
  wellName: string;
  kpis: Kpi;
  cementedData: Record<string, any>[];
  logData: Record<string, any>[];
  cblCurve: string;
  intervals: QualityInterval[];
  layerAnalysis: LayerAnalysisItem[];
  depthCurveName: string;
  step: number;
}

export interface Kpi {
  TOC_Encontrado: number;
  Total_Meters: number;
  Good_Meters: number;
  Medium_Meters: number;
  Bad_Meters: number;
  Good_Bond_Percentage: number;
  TOC_Solicitado?: number;
  Altura_Anillo_Solicitado?: number;
  Diferencia_TOC?: number;
  TOC_Evaluacion_T?: number;
  Adherencia_A?: number;
  Cement_Score?: number;
  Apnz_Percentage?: number;
  Asello_Percentage?: number;
}

export interface QualityInterval {
  Calidad: 'Malo' | 'Medio';
  'Tope (m)': number;
  'Base (m)': number;
  'Longitud (m)': number;
}

export interface LayerAnalysisItem {
  Pozo: string;
  Capa: string;
  'Tope (m)': number;
  'Base (m)': number;
  'Longitud (m)': number;
  'Adherencia (%)': number;
  'Adherencia Sello (%)': number;
}
