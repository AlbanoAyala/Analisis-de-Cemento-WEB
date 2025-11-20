
import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Label
} from 'recharts';
import { UMBRAL_AMPLITUD_BUENA_MV, UMBRAL_AMPLITUD_MALA_MV } from '../constants.ts';

interface LogPlotProps {
  logData: any[];
  cblCurve: string;
  tocFound: number;
  tocRequested?: number;
  depthCurveName: string;
  amplitudeRange: { min: number; max: number };
  depthRange: { min: number; max: number };
}

const LogPlot: React.FC<LogPlotProps> = ({ logData, cblCurve, tocFound, tocRequested, depthCurveName, amplitudeRange, depthRange }) => {
  
  // Use a finer bin size for the log visualization to look like a continuous curve
  const binnedData = useMemo(() => {
    const binSize = 0.1524; // 6 inches (standard log step)
    if (!logData || logData.length === 0) return [];

    // Parse ranges strictly as numbers
    const dMin = Number(depthRange.min);
    const dMax = Number(depthRange.max);

    // Filter based on manual depth range to optimize performance
    const validData = logData.filter(d => 
        d != null && 
        typeof d[depthCurveName] === 'number' && !isNaN(d[depthCurveName]) &&
        d[depthCurveName] >= dMin && d[depthCurveName] <= dMax &&
        typeof d[cblCurve] === 'number' && !isNaN(d[cblCurve])
    );

    if (validData.length === 0) return [];

    const bins = new Map<number, { sum: number, count: number }>();

    validData.forEach(d => {
        // Round to nearest bin
        const binDepth = Math.floor(d[depthCurveName] / binSize) * binSize;
        if (!bins.has(binDepth)) {
            bins.set(binDepth, { sum: 0, count: 0 });
        }
        const bin = bins.get(binDepth)!;
        bin.sum += d[cblCurve];
        bin.count++;
    });

    // Sort by depth ASCENDING (Smallest Depth First) for correct plotting order
    return Array.from(bins.entries()).map(([depth, { sum, count }]) => ({
        [depthCurveName]: depth,
        [cblCurve]: count > 0 ? sum / count : 0,
    })).sort((a, b) => a[depthCurveName] - b[depthCurveName]);
    
  }, [logData, cblCurve, depthCurveName, depthRange]);

  // CRITICAL: Ensure domain is sorted [min, max] strictly numeric. 
  // Combined with reversed={true} on YAxis, this puts min at TOP and max at BOTTOM.
  const yDomain = useMemo(() => {
      const vals = [Number(depthRange.min), Number(depthRange.max)].sort((a, b) => a - b);
      return [vals[0], vals[1]];
  }, [depthRange]);

  // Calculate dynamic height: Multiplier increased to 3px per unit to avoid compression in interactive mode
  const chartHeight = Math.max(800, binnedData.length * 3);

  if (binnedData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-card">
        <p className="text-dark-muted text-xs uppercase tracking-wider">Sin datos en este rango</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e293b] relative border border-slate-700/50 rounded-b-lg overflow-hidden">
      {/* Scrollable Container for the long log */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e293b] relative">
        
        {/* Chart Container with Calculated Height */}
        <div style={{ height: `${chartHeight}px`, width: '100%', minHeight: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
                data={binnedData} 
                layout="vertical"
                margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
                barCategoryGap={-1} // Solid bars, no gaps
                barGap={0}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={true} strokeOpacity={0.2} />
              
              {/* Top Axis (Amplitude) */}
              <XAxis 
                type="number"
                domain={[amplitudeRange.min, amplitudeRange.max]}
                allowDataOverflow={true}
                orientation="top"
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#475569' }}
                axisLine={{ stroke: '#475569' }}
                tickCount={6}
                label={{ value: 'Amplitude (mV)', position: 'insideTop', offset: -20, fill: '#64748b', fontSize: 10 }}
              />

              {/* Left Axis (Depth) - REVERSED=TRUE is the key for Log Plots */}
              <YAxis 
                dataKey={depthCurveName}
                type="number"
                reversed={false} 
                domain={yDomain}
                allowDataOverflow={true}
                interval="preserveStartEnd"
                stroke="#94a3b8"
                tickFormatter={(tick) => tick.toFixed(0)}
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                width={50}
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
                label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              />

              <Tooltip 
                cursor={{fill: '#ffffff', opacity: 0.1}}
                labelFormatter={(label) => `Depth: ${parseFloat(label).toFixed(2)} m`}
                formatter={(value: number) => [value.toFixed(1) + ' mV', 'Amp']}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '4px', color: '#f8fafc', fontSize: '11px' }}
              />

              {/* Threshold Lines */}
              <ReferenceLine x={UMBRAL_AMPLITUD_BUENA_MV} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.6} />
              <ReferenceLine x={UMBRAL_AMPLITUD_MALA_MV} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />

              {/* Data Bars */}
              <Bar dataKey={cblCurve} isAnimationActive={false}>
                {binnedData.map((entry, index) => {
                    const amp = entry[cblCurve];
                    // Color logic: Green < 10, Yellow 10-20, Red > 20
                    let color = '#22c55e';
                    if (amp >= UMBRAL_AMPLITUD_MALA_MV) color = '#ef4444';
                    else if (amp > UMBRAL_AMPLITUD_BUENA_MV) color = '#facc15';

                    return <Cell key={`cell-${index}`} fill={color} stroke={color} />;
                  })}
              </Bar>

              {/* Markers with Labels */}
              <ReferenceLine y={tocFound} stroke="#38bdf8" strokeDasharray="5 5" strokeWidth={2}>
                 <Label value={`TOC Found @ ${tocFound.toFixed(1)} m`} position="insideTopRight" fill="#38bdf8" fontSize={11} fontWeight="bold" offset={5} />
              </ReferenceLine>

              {tocRequested !== undefined && ( 
                  <ReferenceLine y={tocRequested} stroke="#facc15" strokeDasharray="5 5" strokeWidth={2}>
                      <Label value={`TOC Requested @ ${tocRequested.toFixed(1)} m`} position="insideBottomRight" fill="#facc15" fontSize={11} fontWeight="bold" offset={5} />
                  </ReferenceLine>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Legend Overlay */}
      <div className="absolute bottom-2 right-4 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-md border border-slate-700/50 flex gap-4 text-[10px] text-white z-10 shadow-xl">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-green-500 rounded-sm"></span> &lt;10mV</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></span> 10-20mV</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-sm"></span> &gt;20mV</div>
      </div>
    </div>
  );
};

export default LogPlot;
