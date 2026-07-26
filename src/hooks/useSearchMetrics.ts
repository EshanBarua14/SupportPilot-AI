import { useState, useEffect, useCallback } from 'react';

export interface SearchMetrics {
  queryVolume: number;
  clickCount: number;
  ctr: number; // percentage 0 - 100
  lastSearchedAt: string | null;
}

const STORAGE_KEY = 'supportpilot_search_metrics';

export function useSearchMetrics() {
  const [metrics, setMetrics] = useState<SearchMetrics>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const qv = typeof parsed.queryVolume === 'number' ? parsed.queryVolume : 0;
        const cc = typeof parsed.clickCount === 'number' ? parsed.clickCount : 0;
        const ctr = qv > 0 ? (cc / qv) * 100 : 0;
        return {
          queryVolume: qv,
          clickCount: cc,
          ctr: Math.min(100, Number(ctr.toFixed(1))),
          lastSearchedAt: parsed.lastSearchedAt || null
        };
      }
    } catch (e) {
      console.warn('Failed to parse search metrics from localStorage', e);
    }
    return { queryVolume: 0, clickCount: 0, ctr: 0, lastSearchedAt: null };
  });

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
    } catch (e) {
      console.warn('Failed to save search metrics to localStorage', e);
    }
  }, [metrics]);

  const trackQuery = useCallback((query: string) => {
    if (!query || !query.trim()) return;
    setMetrics(prev => {
      const newVolume = prev.queryVolume + 1;
      const newCtr = (prev.clickCount / newVolume) * 100;
      return {
        ...prev,
        queryVolume: newVolume,
        ctr: Math.min(100, Number(newCtr.toFixed(1))),
        lastSearchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });
  }, []);

  const trackClick = useCallback(() => {
    setMetrics(prev => {
      const newClicks = prev.clickCount + 1;
      const volume = Math.max(prev.queryVolume, 1); // Avoid div by zero
      const newCtr = (newClicks / volume) * 100;
      return {
        ...prev,
        clickCount: newClicks,
        ctr: Math.min(100, Number(newCtr.toFixed(1)))
      };
    });
  }, []);

  const resetMetrics = useCallback(() => {
    setMetrics({ queryVolume: 0, clickCount: 0, ctr: 0, lastSearchedAt: null });
  }, []);

  return {
    metrics,
    trackQuery,
    trackClick,
    resetMetrics
  };
}
