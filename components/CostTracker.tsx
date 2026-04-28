
import React, { useEffect, useState } from 'react';
import { Coins, Info } from 'lucide-react';
import { PricingService, CostSummary } from '../services/pricing';

export const CostTracker: React.FC = () => {
  const [costs, setCosts] = useState<CostSummary>({ sessionCost: 0, totalCost: 0, totalTokens: 0 });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = PricingService.subscribe((summary) => {
      setCosts({ ...summary });
    });
    return unsubscribe;
  }, []);

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(cost);
  };

  const formatTokens = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <div className={`fixed bottom-4 left-4 z-50 transition-all ${isOpen ? 'scale-100' : 'scale-100'}`}>
      <div 
        className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-lg rounded-full px-4 py-2 flex items-center gap-3 text-xs font-mono text-slate-600 hover:border-blue-300 transition-colors cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={`flex items-center gap-2 ${costs.sessionCost > 0 ? 'text-blue-600 font-bold' : ''}`}>
           <Coins size={14} />
           <span>{formatCost(costs.sessionCost)}</span>
        </div>
        
        {isOpen && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200 animate-in fade-in slide-in-from-left-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total</span>
                    <span>{formatCost(costs.totalCost)}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Tokens</span>
                    <span>{formatTokens(costs.totalTokens)}</span>
                </div>
            </div>
        )}

        {!isOpen && costs.sessionCost > 0 && (
            <span className="text-[10px] text-blue-400 animate-pulse">●</span>
        )}
      </div>
    </div>
  );
};
