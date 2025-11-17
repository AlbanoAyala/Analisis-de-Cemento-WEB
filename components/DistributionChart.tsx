import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { UMBRAL_AMPLITUD_BUENA_MV, UMBRAL_AMPLITUD_MALA_MV } from '../constants.ts';

interface DistributionChartProps {
  data: any[];
  cblCurve: string;
  step: number;
}

const DistributionChart: React.FC<DistributionChartProps> = ({ data, cblCurve, step }) => {
  const containerClasses = "relative p-4 bg-dark-card rounded-lg shadow-lg h-[400px]";

  if (!data || data.length === 0) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center justify-center h-full text-gray-400">No data available for distribution chart.</div>
      </div>
    );
  }

  // Bin the data
  const binWidth = 2;
  const cblValues = data.map(d => d[cblCurve]).filter(v => v != null && !isNaN(v));
  if (cblValues.length === 0) {
      return (
          <div className={containerClasses}>
              <div className="flex items-center justify-center h-full text-gray-400">No valid CBL amplitude data found.</div>
          </div>
      );
  }

  const maxAmp = cblValues.reduce((max, current) => Math.max(max, current), -Infinity);
  const bins = new Map<number, { Bueno: number, Medio: number, Malo: number }>();

  for (let i = 0; i <= Math.ceil(maxAmp / binWidth); i++) {
    bins.set(i * binWidth, { Bueno: 0, Medio: 0, Malo: 0 });
  }

  data.forEach(d => {
    if (d[cblCurve] == null) return;
    const bin = Math.floor(d[cblCurve] / binWidth) * binWidth;
    if (bins.has(bin)) {
      const currentBin = bins.get(bin)!;
      currentBin[d.Category as 'Bueno' | 'Medio' | 'Malo']++;
    }
  });

  const chartData = Array.from(bins.entries()).map(([amp, counts]) => ({
    amplitude: amp,
    ...counts,
  }));

  // If binning results in no data (e.g., all amplitude values are negative),
  // rendering an empty chart can crash the PDF generator.
  if (chartData.length === 0) {
    return (
        <div className={containerClasses}>
            <div className="flex items-center justify-center h-full text-gray-400">
                No data available to display in distribution chart.
            </div>
        </div>
    );
  }

  const totalMeters = data.length * step;
  const goodMeters = data.filter(d => d.Category === 'Bueno').length * step;
  const mediumMeters = data.filter(d => d.Category === 'Medio').length * step;
  const badMeters = data.filter(d => d.Category === 'Malo').length * step;

  return (
    <div className={containerClasses}>
      <h3 className="text-lg font-semibold mb-4 text-center text-gray-300">CBL Amplitude Distribution (mV)</h3>
      <div className="flex">
        <div className="w-3/4 h-full">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                <XAxis 
                  dataKey="amplitude" 
                  stroke="#A0AEC0"
                  label={{ value: "Amplitude (mV)", position: "insideBottom", offset: -15, fill: "#A0AEC0" }}
                />
                <YAxis 
                  stroke="#A0AEC0"
                  label={{ value: "Frequency (count)", angle: -90, position: "insideLeft", style: { textAnchor: 'middle' }, fill: "#A0AEC0" }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
                  labelStyle={{ color: '#E2E8F0' }}
                />
                <Legend wrapperStyle={{ color: '#E2E8F0', paddingTop: '20px' }} />
                <Bar dataKey="Bueno" stackId="a" fill="#22C55E" name="Good" />
                <Bar dataKey="Medio" stackId="a" fill="#FBBF24" name="Medium" />
                <Bar dataKey="Malo" stackId="a" fill="#EF4444" name="Bad" />
              </BarChart>
            </ResponsiveContainer>
        </div>
        <div className="w-1/4 pl-6 flex flex-col justify-center">
            <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                <h4 className="font-bold text-gray-300 mb-2">Summary</h4>
                <p className="text-sm text-gray-400">Total: {totalMeters.toFixed(2)} m</p>
                <div className="mt-2 space-y-1">
                    <p className="text-sm text-green-400">Bueno: {goodMeters.toFixed(2)} m ({totalMeters > 0 ? (goodMeters/totalMeters*100).toFixed(1) : 0}%)</p>
                    <p className="text-sm text-yellow-400">Medio: {mediumMeters.toFixed(2)} m ({totalMeters > 0 ? (mediumMeters/totalMeters*100).toFixed(1) : 0}%)</p>
                    <p className="text-sm text-red-400">Malo: {badMeters.toFixed(2)} m ({totalMeters > 0 ? (badMeters/totalMeters*100).toFixed(1) : 0}%)</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DistributionChart;