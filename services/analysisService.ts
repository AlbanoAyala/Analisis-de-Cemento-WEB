
import { LasData, LayerData, AnalysisResult, Kpi } from '../types.ts';
import * as C from '../constants.ts';

function interpolate(data: Record<string, any>[], key: string): void {
    let lastGoodIndex = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i][key] != null && !isNaN(data[i][key])) {
            if (lastGoodIndex !== -1 && i - lastGoodIndex > 1) {
                const startVal = data[lastGoodIndex][key];
                const endVal = data[i][key];
                const diff = endVal - startVal;
                const steps = i - lastGoodIndex;
                for (let j = 1; j < steps; j++) {
                    data[lastGoodIndex + j][key] = startVal + (diff * j / steps);
                }
            }
            lastGoodIndex = i;
        }
    }
}

export const analyzeData = (
  lasData: LasData,
  layersData: LayerData[],
  tocSolicitado: number,
  alturaAnilloSolicitado: number
): AnalysisResult => {

  const depthCurve = lasData.depthCurveName;
  const cblCurve = C.NOMBRES_CURVA_CBL.find(curve => lasData.curves.includes(curve));
  
  if (!cblCurve) {
    throw new Error(`No compatible CBL curve found in the LAS file. Looked for: ${C.NOMBRES_CURVA_CBL.join(', ')}`);
  }

  // STRICT FILTER: Remove any data with Depth <= 0 or Amplitude < 0 immediately
  let logData = lasData.data.filter(d => 
      d[depthCurve] > 0 && 
      (d[cblCurve] === undefined || d[cblCurve] >= 0)
  );

  if (logData.length === 0) {
      throw new Error("No valid data found (Depth > 0 and Amplitude >= 0).");
  }

  logData.sort((a, b) => a[depthCurve] - b[depthCurve]);

  // 1. Detectar TOC
  const tocData = logData.filter(d => d[cblCurve] != null && !isNaN(d[cblCurve]));
  let tocDepth = logData.length > 0 ? logData[0][depthCurve] : 0;

  if (tocData.length > 0) {
      const meetsThreshold = tocData.map(d => d[cblCurve] < C.TOC_AMPLITUD_UMBRAL);
      const blocks: {start: number, end: number}[] = [];
      let currentBlockStart = -1;

      for(let i = 0; i < meetsThreshold.length; i++) {
          if (meetsThreshold[i] && currentBlockStart === -1) {
              currentBlockStart = i;
          } else if (!meetsThreshold[i] && currentBlockStart !== -1) {
              blocks.push({start: currentBlockStart, end: i - 1});
              currentBlockStart = -1;
          }
      }
      if (currentBlockStart !== -1) {
          blocks.push({start: currentBlockStart, end: meetsThreshold.length - 1});
      }

      const validBlocks = blocks.filter(b => (tocData[b.end][depthCurve] - tocData[b.start][depthCurve]) >= C.TOC_LONGITUD_MINIMA_M);

      if (validBlocks.length > 0) {
          tocDepth = tocData[validBlocks[0].start][depthCurve];
      } else {
          // Fallback to gradient method if no valid blocks
          let minGradient = Infinity;
          let minGradientIndex = -1;
          for (let i = 1; i < tocData.length; i++) {
              const gradient = tocData[i][cblCurve] - tocData[i - 1][cblCurve];
              if (gradient < minGradient) {
                  minGradient = gradient;
                  minGradientIndex = i;
              }
          }
          if (minGradientIndex > -1) {
             tocDepth = tocData[minGradientIndex][depthCurve];
          }
      }
  }


  // 2. Filtrar y procesar datos cementados
  const cementedData: Record<string, any>[] = logData.filter(d => d[depthCurve] >= tocDepth);
  
  if (cementedData.length === 0) {
    // If no data below TOC, use what we have but warn implicitly by returning empty cemented
    // or just allow it to be empty to avoid crash, but logical check needed.
    // For robustness, we'll process if we have data, otherwise error.
    // throw new Error("No data found in the cemented interval below the detected TOC.");
  }
  
  // Interpolate
  if (cementedData.length > 0) {
      [cblCurve, 'CLDC', 'NEU'].forEach(key => {
          if (lasData.curves.includes(key)) {
              interpolate(cementedData, key);
          }
      });

      // Categorize
      cementedData.forEach(d => {
        const amp = d[cblCurve];
        if (amp >= C.UMBRAL_AMPLITUD_MALA_MV) d.Category = 'Malo';
        else if (amp > C.UMBRAL_AMPLITUD_BUENA_MV && amp < C.UMBRAL_AMPLITUD_MALA_MV) d.Category = 'Medio';
        else d.Category = 'Bueno';
      });
  }

  // 3. Calcular KPIs
  const step = lasData.step;
  const metrosBuenos = cementedData.filter(d => d.Category === 'Bueno').length * step;
  const metrosMedios = cementedData.filter(d => d.Category === 'Medio').length * step;
  const metrosMalos = cementedData.filter(d => d.Category === 'Malo').length * step;
  const metrosTotales = metrosBuenos + metrosMedios + metrosMalos;

  const kpis: Kpi = {
    TOC_Encontrado: tocDepth,
    Total_Meters: metrosTotales,
    Good_Meters: metrosBuenos,
    Medium_Meters: metrosMedios,
    Bad_Meters: metrosMalos,
    Good_Bond_Percentage: metrosTotales > 0 ? (metrosBuenos / metrosTotales) * 100 : 0,
    TOC_Solicitado: tocSolicitado,
    Altura_Anillo_Solicitado: alturaAnilloSolicitado,
  };
  
  let T: number | undefined;
  let A: number | undefined;

  if(tocSolicitado > 0 && alturaAnilloSolicitado > 0) {
      const diferenciaToc = tocSolicitado - tocDepth;
      kpis.Diferencia_TOC = tocDepth - tocSolicitado;

      if (diferenciaToc >= 0 && diferenciaToc <= 40.0) T = 1.0;
      else if (diferenciaToc > 40.0) T = 0.9;
      else if (diferenciaToc < 0 && diferenciaToc >= -40.0) T = 0.8;
      else if (diferenciaToc < -40.0) T = 0.0;
      kpis.TOC_Evaluacion_T = T !== undefined ? T * 100 : undefined;
      
      const M = metrosMalos + metrosMedios;
      A = 1 - (M / alturaAnilloSolicitado);
      A = Math.max(0, Math.min(1, A)); // clip
      kpis.Adherencia_A = A * 100;
  }
  
  if (T !== undefined && A !== undefined) {
      let E = (30 * T) + (70 * A);
      E = Math.max(0, Math.min(100, E)); // clip
      kpis.Cement_Score = E;
  }

  const calcularAdherenciaIntervalo = (df: Record<string, any>[]) => {
      if (df.length === 0) return { A: NaN, longitud: 0 };
      const malos = df.filter(d => d.Category === 'Malo').length * step;
      const medios = df.filter(d => d.Category === 'Medio').length * step;
      const longitud = (df[df.length - 1][depthCurve] - df[0][depthCurve]) + step;
      const M = malos + medios;
      let A_val = 1 - (M / longitud);
      return { A: Math.max(0, Math.min(1, A_val)), longitud };
  };

  if (layersData.length > 0 && cementedData.length > 0) {
      let total_M_capas = 0, total_length_capas = 0;
      let total_M_sellos = 0, total_length_sellos = 0;
      const minDepthCemented = cementedData[0][depthCurve];
      const maxDepthCemented = cementedData[cementedData.length - 1][depthCurve];

      layersData.forEach(capa => {
          const df_capa = cementedData.filter(d => d[depthCurve] >= capa.top && d[depthCurve] <= capa.base);
          const { A: A_capa, longitud: longitud_capa } = calcularAdherenciaIntervalo(df_capa);
          if (!isNaN(A_capa) && longitud_capa > 0) {
              total_M_capas += (1 - A_capa) * longitud_capa;
              total_length_capas += longitud_capa;
          }

          const sello_top = Math.max(capa.top - C.RANGO_SELLO_METROS, minDepthCemented);
          const sello_base = Math.min(capa.base + C.RANGO_SELLO_METROS, maxDepthCemented);
          const df_sello = cementedData.filter(d => d[depthCurve] >= sello_top && d[depthCurve] <= sello_base);
          const { A: A_sello, longitud: longitud_sello } = calcularAdherenciaIntervalo(df_sello);
          if (!isNaN(A_sello) && longitud_sello > 0) {
              total_M_sellos += (1 - A_sello) * longitud_sello;
              total_length_sellos += longitud_sello;
          }
      });
      
      const Apnz = total_length_capas > 0 ? (1 - (total_M_capas / total_length_capas)) * 100 : NaN;
      kpis.Apnz_Percentage = isNaN(Apnz) ? undefined : Math.max(0, Math.min(100, Apnz));

      const Asello = total_length_sellos > 0 ? (1 - (total_M_sellos / total_length_sellos)) * 100 : NaN;
      kpis.Asello_Percentage = isNaN(Asello) ? undefined : Math.max(0, Math.min(100, Asello));
  }
  
  // 4. Find Quality Intervals
    const intervals: any[] = [];
    if(cementedData.length > 0) {
        let currentCategory = cementedData[0].Category;
        let blockStartDepth = cementedData[0][depthCurve];

        for (let i = 1; i < cementedData.length; i++) {
            if (cementedData[i].Category !== currentCategory) {
                intervals.push({
                    Category: currentCategory,
                    Top: blockStartDepth,
                    Base: cementedData[i-1][depthCurve],
                });
                currentCategory = cementedData[i].Category;
                blockStartDepth = cementedData[i][depthCurve];
            }
        }
        intervals.push({
            Category: currentCategory,
            Top: blockStartDepth,
            Base: cementedData[cementedData.length - 1][depthCurve],
        });
    }
  
    const longitudMinimaM = C.INTERVALO_LONGITUD_MINIMA_FT * 0.3048;
    const filteredIntervals = intervals
        .map(i => ({ ...i, 'Length_m': i.Base - i.Top }))
        .filter(i => i.Length_m >= longitudMinimaM && (i.Category === 'Malo' || i.Category === 'Medio'))
        .map(i => ({
            'Calidad': i.Category,
            'Tope (m)': i.Top,
            'Base (m)': i.Base,
            'Longitud (m)': i.Length_m,
        }));


    // 5. Layer Analysis
    const layerAnalysis: any[] = [];
    if (layersData.length > 0 && cementedData.length > 0) {
        layersData.forEach(capa => {
            const df_capa = cementedData.filter(d => d[depthCurve] >= capa.top && d[depthCurve] <= capa.base);
            const { A: A_capa, longitud: longitud_capa } = calcularAdherenciaIntervalo(df_capa);

            const minDepthCemented = cementedData[0][depthCurve];
            const maxDepthCemented = cementedData[cementedData.length-1][depthCurve];
            const sello_top = Math.max(capa.top - C.RANGO_SELLO_METROS, minDepthCemented);
            const sello_base = Math.min(capa.base + C.RANGO_SELLO_METROS, maxDepthCemented);
            const df_sello = cementedData.filter(d => d[depthCurve] >= sello_top && d[depthCurve] <= sello_base);
            const { A: A_sello } = calcularAdherenciaIntervalo(df_sello);

            layerAnalysis.push({
                Pozo: lasData.wellName,
                Capa: capa.wellName,
                'Tope (m)': capa.top,
                'Base (m)': capa.base,
                'Longitud (m)': longitud_capa,
                'Adherencia (%)': !isNaN(A_capa) ? A_capa * 100 : NaN,
                'Adherencia Sello (%)': !isNaN(A_sello) ? A_sello * 100 : NaN
            });
        });
    }

    // Explicitly merge Category into the main logData for plotting
    const categoryMap = new Map<number, string>();
    cementedData.forEach(d => {
      if (d[depthCurve] !== undefined && d.Category) {
        categoryMap.set(d[depthCurve], d.Category);
      }
    });

    const enrichedLogData = logData.map(d => {
      const category = categoryMap.get(d[depthCurve]);
      return category ? { ...d, Category: category } : d;
    });

  return {
    wellName: lasData.wellName,
    kpis,
    cementedData,
    logData: enrichedLogData,
    cblCurve,
    intervals: filteredIntervals,
    layerAnalysis,
    depthCurveName: depthCurve,
    step: lasData.step,
  };
};
