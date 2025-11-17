import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
// FIX: Corrected typo in constant names from AMPLITUDE to AMPLITUD.
import { UMBRAL_AMPLITUD_BUENA_MV, UMBRAL_AMPLITUD_MALA_MV } from '../constants.ts';

interface LogPlotProps {
  logData: any[];
  cblCurve: string;
  tocFound: number;
  tocRequested?: number;
  depthCurveName: string;
  amplitudeRange: { min: number; max: number };
}

const LogPlot: React.FC<LogPlotProps> = ({ logData, cblCurve, tocFound, tocRequested, depthCurveName, amplitudeRange }) => {
  const binnedData = useMemo(() => {
    const binSize = 0.5; // Aggregate data every 0.5 meters
    if (!logData || logData.length === 0) return [];

    const validData = logData.filter(d => 
        d != null && 
        typeof d[depthCurveName] === 'number' && !isNaN(d[depthCurveName]) &&
        typeof d[cblCurve] === 'number' && !isNaN(d[cblCurve])
    );

    if (validData.length === 0) return [];

    const bins = new Map<number, { sum: number, count: number }>();

    validData.forEach(d => {
        const binStartDepth = Math.floor(d[depthCurveName] / binSize) * binSize;
        if (!bins.has(binStartDepth)) {
            bins.set(binStartDepth, { sum: 0, count: 0 });
        }
        const bin = bins.get(binStartDepth)!;
        bin.sum += d[cblCurve];
        bin.count++;
    });

    return Array.from(bins.entries()).map(([depth, { sum, count }]) => ({
        [depthCurveName]: depth + binSize / 2, // Plot at the midpoint of the bin
        [cblCurve]: count > 0 ? sum / count : 0,
    })).sort((a, b) => a[depthCurveName] - b[depthCurveName]);
    
  }, [logData, cblCurve, depthCurveName]);

  if (binnedData.length === 0) {
    return (
      <div className="p-4 bg-dark-card rounded-lg shadow-lg h-[800px] mt-6 flex items-center justify-center">
        <p className="text-gray-400">No valid data to display in Cementation Report.</p>
      </div>
    );
  }

  const yDomain = useMemo(() => {
    const depthValues = logData
        .map(d => d[depthCurveName])
        .filter(d => d != null && !isNaN(d));

    if (depthValues.length === 0 && tocFound == null && tocRequested == null) {
        return [0, 1000]; // Default fallback
    }
    
    const pointsOfInterest = depthValues;
    if (tocFound != null && !isNaN(tocFound)) {
        pointsOfInterest.push(tocFound);
    }
    if (tocRequested != null && !isNaN(tocRequested)) {
        pointsOfInterest.push(tocRequested);
    }

    if (pointsOfInterest.length === 0) {
        return [0, 1000];
    }
    
    let minDepth = pointsOfInterest[0];
    let maxDepth = pointsOfInterest[0];

    for (const depth of pointsOfInterest) {
      if (depth < minDepth) minDepth = depth;
      if (depth > maxDepth) maxDepth = depth;
    }

    const padding = (maxDepth - minDepth) * 0.05;

    return [minDepth - padding, maxDepth + padding];
  }, [logData, depthCurveName, tocFound, tocRequested]);

  const lightColor = '#A0AEC0';
  
  const qualityLegendPayload = [
      { value: 'Bueno (<10 mV)', type: 'square', color: '#22C55E' },
      { value: 'Medio (10-20 mV)', type: 'square', color: '#FBBF24' },
      { value: 'Malo (>= 20 mV)', type: 'square', color: '#EF4444' },
  ];
  
  const chartMargin = { top: 20, right: 30, left: 50, bottom: 5 };

  const renderQualityLegend = () => {
    return (
      <ul style={{ color: lightColor, display: 'flex', justifyContent: 'center', listStyle: 'none', margin: 0, padding: 0, gap: '1rem' }}>
        {qualityLegendPayload.map((entry, index) => (
          <li key={`item-${index}`} style={{ display: 'flex', alignItems: 'center' }}>
            <svg width={10} height={10} style={{ marginRight: '5px' }}>
              <rect width={10} height={10} fill={entry.color} />
            </svg>
            <span>{entry.value}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="p-4 bg-dark-card rounded-lg shadow-lg h-[800px]">
      <h3 className="text-lg font-semibold mb-2 text-center text-gray-300">Cementation Report</h3>
      <div className="flex justify-center mb-4">
        {renderQualityLegend()}
      </div>
      <div className="flex w-full h-[calc(95%-2.5rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
              data={binnedData} 
              layout="vertical"
              margin={chartMargin}
              barCategoryGap={0}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568"/>
            <XAxis 
              type="number"
              domain={[amplitudeRange.min, amplitudeRange.max]}
              allowDataOverflow={true}
              orientation="top"
              label={{ value: `Amplitude (${cblCurve})`, position: 'top', offset: -5, fill: lightColor }}
              stroke={lightColor}
              tick={{ fill: lightColor, fontSize: 10 }}
            />
            <YAxis 
              dataKey={depthCurveName}
              type="number"
              reversed={false}
              domain={yDomain}
              allowDataOverflow={true}
              stroke={lightColor}
              tickFormatter={(tick) => tick.toFixed(0)}
              tick={{ fill: lightColor, fontSize: 10 }}
              label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: lightColor }}
            />
            <Tooltip 
              labelFormatter={(label) => {
                  const depth = parseFloat(label);
                  const binSize = 0.5;
                  const startDepth = depth - binSize / 2;
                  return `Depth: ${startDepth.toFixed(2)} - ${(startDepth + binSize).toFixed(2)} m`;
              }}
              formatter={(value: number) => [value.toFixed(2), 'Avg. Amplitude']}
              contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
              labelStyle={{ color: '#E2E8F0' }}
            />
            <ReferenceLine x={UMBRAL_AMPLITUD_BUENA_MV} stroke="#FBBF24" strokeDasharray="3 3" ifOverflow="visible" />
            <ReferenceLine x={UMBRAL_AMPLITUD_MALA_MV} stroke="#EF4444" strokeDasharray="3 3" ifOverflow="visible" />
            <Bar
              dataKey={cblCurve}
              isAnimationActive={false}
            >
              {binnedData.map((entry, index) => {
                  const amp = entry[cblCurve];
                  const color = amp >= UMBRAL_AMPLITUD_MALA_MV ? '#EF4444' // Malo
                              : amp >= UMBRAL_AMPLITUD_BUENA_MV ? '#FBBF24' // Medio
                              : '#22C55E'; // Bueno
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
            </Bar>
            <ReferenceLine y={tocFound} stroke="#38BDF8" strokeDasharray="5 5" ifOverflow="visible" label={{ value: `TOC Found @ ${tocFound.toFixed(2)} m`, position: 'insideBottomRight', fill: '#38BDF8', fontSize: 12 }} />
            {tocRequested !== undefined && ( <ReferenceLine y={tocRequested} stroke="#FBBF24" strokeDasharray="5 5" ifOverflow="visible" label={{ value: `TOC Requested @ ${tocRequested.toFixed(2)} m`, position: 'insideTopRight', fill: '#FBBF24', fontSize: 12 }} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LogPlot;