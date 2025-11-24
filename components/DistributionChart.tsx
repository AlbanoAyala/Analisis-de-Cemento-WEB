
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DistributionChartProps {
  data: any[];
  cblCurve: string;
  step: number;
}

const DistributionChart: React.FC<DistributionChartProps> = ({ data, cblCurve, step }) => {
  
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const binSize = 2; 
    // STRICT FILTER: Amplitude must be >= 0
    const cblValues = data.map(d => d[cblCurve]).filter(v => v != null && !isNaN(v) && v >= 0);
    
    if (cblValues.length === 0) return [];

    const maxVal = Math.max(...cblValues);
    // Ensure we cover up to the max value plus padding
    const maxBin = Math.ceil(maxVal / binSize) * binSize;
    
    const bins = new Map<number, number>();
    // Initialize all bins
    for(let i=0; i<=maxBin; i+=binSize) {
        bins.set(i, 0);
    }

    cblValues.forEach(v => {
        const bin = Math.floor(v / binSize) * binSize;
        bins.set(bin, (bins.get(bin) || 0) + 1);
    });

    const result = Array.from(bins.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([binStart, count]) => ({
            name: binStart.toString(),
            binStart,
            count,
            // Strict Coloring: Green < 10, Yellow 10-20, Red >= 20
            fill: binStart < 10 ? '#22c55e' : binStart < 20 ? '#facc15' : '#ef4444'
        }));
        
    // Trim long tails of zeros if they extend too far
    // But keep enough to show the "Good/Bad" range transition
    let lastIndex = result.length - 1;
    for(let i = lastIndex; i >= 0; i--) {
        if(result[i].count > 0) {
            lastIndex = i;
            break;
        }
    }
    return result.slice(0, Math.max(15, lastIndex + 2)); // Ensure at least some width

  }, [data, cblCurve]);

  const stats = useMemo(() => {
    const totalMeters = data.length * step;
    const goodMeters = data.filter(d => d.Category === 'Bueno').length * step;
    const mediumMeters = data.filter(d => d.Category === 'Medio').length * step;
    const badMeters = data.filter(d => d.Category === 'Malo').length * step;
    
    return {
        total: totalMeters,
        good: goodMeters,
        med: mediumMeters,
        bad: badMeters,
        goodPct: totalMeters > 0 ? (goodMeters / totalMeters) * 100 : 0,
        medPct: totalMeters > 0 ? (mediumMeters / totalMeters) * 100 : 0,
        badPct: totalMeters > 0 ? (badMeters / totalMeters) * 100 : 0
    };
  }, [data, step]);

  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-dark-muted">No hay datos</div>;
  }

  return (
    <div className="flex h-full bg-dark-card w-full">
      {/* Chart Section */}
      <div className="flex-1 flex flex-col p-4 min-w-0 relative">
        <h3 className="text-center text-xs font-bold text-white uppercase mb-2 tracking-wider">CBL Amplitude Distribution (mV)</h3>
        <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap={1} margin={{top: 10, right: 10, left: 0, bottom: 10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} strokeOpacity={0.3} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        tick={{fontSize: 9}} 
                        interval={0}
                        ticks={chartData.filter((_, i) => i % 2 === 0).map(d => d.name)} // Show every 2nd tick for space
                        label={{ value: 'Amplitude (mV)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#94a3b8' }}
                        height={30}
                    />
                    <YAxis 
                        stroke="#94a3b8" 
                        tick={{fontSize: 9}} 
                        label={{ value: 'Frequency (count)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} 
                    />
                    <Tooltip 
                        cursor={{fill: '#ffffff', opacity: 0.05}}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '11px' }}
                        formatter={(value: number) => [value, 'Count']}
                        labelFormatter={(label) => `Amp: ${label} - ${parseInt(label)+2} mV`}
                    />
                    <Bar dataKey="count" name="Frequency" radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex justify-center gap-6 text-[10px] text-dark-muted mt-1 pb-1">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-sm"></span> Good (&lt;10mV)</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-yellow-400 rounded-sm"></span> Medium (10-20mV)</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-500 rounded-sm"></span> Bad (&gt;20mV)</div>
        </div>
      </div>

      {/* Summary Panel */}
      <div className="w-56 bg-[#161e2e] border-l border-dark-surface p-4 flex flex-col justify-center shrink-0 shadow-xl z-10">
         <div className="bg-[#1e293b] rounded-lg p-4 border border-slate-700/50 shadow-lg">
            <h4 className="text-white font-bold text-sm mb-4 border-b border-slate-600 pb-2 flex justify-between items-center">
                Summary
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </h4>
            
            <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-slate-700/30 pb-1">
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Total Depth</span>
                    <span className="text-sm font-mono text-white font-bold">{stats.total.toFixed(2)} m</span>
                </div>
                
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-green-400 uppercase font-bold">Bueno</span>
                        <span className="text-[10px] text-green-400/70">({stats.goodPct.toFixed(1)}%)</span>
                    </div>
                    <div className="text-sm font-mono text-white bg-green-900/10 px-2 py-1 rounded border border-green-900/20 text-right">{stats.good.toFixed(2)} m</div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-yellow-400 uppercase font-bold">Medio</span>
                        <span className="text-[10px] text-yellow-400/70">({stats.medPct.toFixed(1)}%)</span>
                    </div>
                    <div className="text-sm font-mono text-white bg-yellow-900/10 px-2 py-1 rounded border border-yellow-900/20 text-right">{stats.med.toFixed(2)} m</div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-red-400 uppercase font-bold">Malo</span>
                        <span className="text-[10px] text-red-400/70">({stats.badPct.toFixed(1)}%)</span>
                    </div>
                    <div className="text-sm font-mono text-white bg-red-900/10 px-2 py-1 rounded border border-red-900/20 text-right">{stats.bad.toFixed(2)} m</div>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default DistributionChart;
