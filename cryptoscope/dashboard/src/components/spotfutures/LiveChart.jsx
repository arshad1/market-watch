import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createChart, LineStyle, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import { 
  Activity, Settings, Eye, EyeOff, Code, 
  TrendingUp, TrendingDown, RefreshCw, X, Sliders,
  Layers, Zap, Target, BarChart2, Crosshair, Waves
} from 'lucide-react';
import { parseAndExecutePine, calculateSMA, calculateEMA, calculateRSI } from './pinescript';
import {
  calculateBollingerBands,
  calculateSqueezeMomentum,
  detectSMC,
  calculateNadarayaWatson,
  calculateMACD,
  calculateSupertrend,
  calculateVWAP,
  calculateIchimoku,
  calculateStochRSI,
  calculateATRTrailingStop,
  detectLiquiditySweeps,
  calculateVolumeProfile,
  detectDivergences,
  calculateKNNProjection
} from './indicators';
import PineEditor from './PineEditor';

// ── Indicator Category Definitions ──
const INDICATOR_CATEGORIES = {
  overlays: {
    label: 'Overlays',
    icon: Layers,
    items: [
      { key: 'ema20', label: 'EMA 20', premium: false },
      { key: 'ema50', label: 'EMA 50', premium: false },
      { key: 'bb', label: 'Bollinger Bands', premium: false },
      { key: 'vwap', label: 'VWAP + Bands', premium: true },
      { key: 'ichimoku', label: 'Ichimoku Cloud', premium: true },
      { key: 'supertrend', label: 'Supertrend', premium: true },
      { key: 'nw', label: 'Nadaraya-Watson', premium: true },
      { key: 'atrStop', label: 'ATR Trail Stop', premium: true },
    ]
  },
  smartMoney: {
    label: 'Smart Money',
    icon: Target,
    items: [
      { key: 'smc', label: 'BOS / CHoCH / FVG', premium: true },
      { key: 'liqSweep', label: 'Liquidity Sweeps', premium: true },
      { key: 'volProfile', label: 'Volume Profile', premium: true },
      { key: 'divergence', label: 'RSI Divergences', premium: true },
    ]
  },
  aiModels: {
    label: 'AI Models',
    icon: Zap,
    items: [
      { key: 'aiForecast', label: 'AI Forecast (KNN)', premium: true },
    ]
  },
  oscillators: {
    label: 'Oscillators',
    icon: Waves,
    items: [
      { key: 'rsi', label: 'RSI Panel', premium: false },
      { key: 'macd', label: 'MACD Panel', premium: true },
      { key: 'squeeze', label: 'Squeeze Momentum', premium: true },
      { key: 'stochRsi', label: 'Stochastic RSI', premium: true },
    ]
  }
};

const LiveChart = ({ asset, timeframe, token }) => {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ticker, setTicker] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  
  // ── Indicator Toggles ──
  const [activeIndicators, setActiveIndicators] = useState({
    ema20: true,
    ema50: false,
    bb: false,
    vwap: false,
    ichimoku: false,
    supertrend: false,
    nw: false,
    atrStop: false,
    smc: true,
    liqSweep: false,
    volProfile: false,
    divergence: false,
    rsi: false,
    macd: false,
    squeeze: false,
    stochRsi: false,
    aiForecast: true,
  });

  const [showPineEditor, setShowPineEditor] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('overlays');

  // ── Configurable Settings ──
  const [settings, setSettings] = useState({
    ema20: { period: 20, color: '#3b82f6', width: 2 },
    ema50: { period: 50, color: '#ef4444', width: 2 },
    bb: { period: 20, multiplier: 2.0, color: 'rgba(136, 132, 216, 0.4)' },
    vwap: { showBands: true, color: '#f59e0b', bandColor: 'rgba(245, 158, 11, 0.15)' },
    ichimoku: { tenkan: 9, kijun: 26, senkouB: 52, displacement: 26, cloudOpacity: 0.08 },
    supertrend: { period: 10, multiplier: 3.0, upColor: '#10b981', downColor: '#ef4444' },
    nw: { bandwidth: 8, multiplier: 3.0, color: '#a78bfa', envelopeColor: 'rgba(167, 139, 250, 0.12)' },
    atrStop: { period: 22, multiplier: 3.0, longColor: '#10b981', shortColor: '#ef4444' },
    smc: { swingLookback: 4, showFVG: true, showBOS: true },
    liqSweep: { lookback: 10, threshold: 0.3 },
    volProfile: { bins: 24, pocColor: '#f59e0b', vaColor: 'rgba(59, 130, 246, 0.12)' },
    divergence: { rsiPeriod: 14, pivotLookback: 5 },
    rsi: { period: 14, color: '#f59e0b' },
    macd: { fast: 12, slow: 26, signal: 9, macdColor: '#3b82f6', signalColor: '#ef4444' },
    squeeze: { length: 20, mult: 2.0, lengthKC: 20, multKC: 1.5 },
    stochRsi: { rsiLen: 14, stochLen: 14, kSmooth: 3, dSmooth: 3, kColor: '#3b82f6', dColor: '#ef4444' },
    aiForecast: { lookback: 14, forward: 10, k: 5, color: '#f0abfc' },
  });

  const updateSetting = useCallback((indicator, field, value) => {
    setSettings(prev => ({
      ...prev,
      [indicator]: {
        ...prev[indicator],
        [field]: value
      }
    }));
  }, []);

  const toggleIndicator = useCallback((key) => {
    setActiveIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Pine script state
  const [pineScript, setPineScript] = useState('');
  const [pinePlots, setPinePlots] = useState([]);
  const [pineErrors, setPineErrors] = useState([]);

  // ── Chart Refs ──
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const macdContainerRef = useRef(null);
  const sqzContainerRef = useRef(null);
  const stochRsiContainerRef = useRef(null);

  const chartRef = useRef(null);
  const rsiChartRef = useRef(null);
  const macdChartRef = useRef(null);
  const sqzChartRef = useRef(null);
  const stochRsiChartRef = useRef(null);

  const candleSeriesRef = useRef(null);
  const ema20SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const bbUpperSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);
  const bbBasisSeriesRef = useRef(null);

  // New premium series refs
  const vwapSeriesRef = useRef(null);
  const vwapUpper1Ref = useRef(null);
  const vwapLower1Ref = useRef(null);
  const vwapUpper2Ref = useRef(null);
  const vwapLower2Ref = useRef(null);

  const ichimokuTenkanRef = useRef(null);
  const ichimokuKijunRef = useRef(null);
  const ichimokuSpanARef = useRef(null);
  const ichimokuSpanBRef = useRef(null);

  const supertrendRef = useRef(null);

  const nwSmoothedRef = useRef(null);
  const nwUpperRef = useRef(null);
  const nwLowerRef = useRef(null);

  const atrStopRef = useRef(null);
  const aiForecastRef = useRef(null);

  // Oscillator series refs
  const rsiSeriesRef = useRef(null);
  const macdLineRef = useRef(null);
  const macdSignalRef = useRef(null);
  const macdHistRef = useRef(null);
  const sqzHistogramSeriesRef = useRef(null);
  const sqzMidlineSeriesRef = useRef(null);
  const sqzMarkersRef = useRef(null);
  const stochKRef = useRef(null);
  const stochDRef = useRef(null);

  const pineSeriesRefs = useRef({});
  const priceLinesRef = useRef([]);
  const candleMarkersRef = useRef(null);
  const wsRef = useRef(null);

  const deltaSymbol = useMemo(() => {
    let sym = asset.replace('/USDT', 'USD');
    if (!sym.endsWith('USD') && !sym.endsWith('USDT')) {
      sym = sym + 'USD';
    }
    return sym.replace('/', '');
  }, [asset]);

  // ── Determine which sub-panels are visible ──
  const showRsiPanel = activeIndicators.rsi;
  const showMacdPanel = activeIndicators.macd;
  const showSqzPanel = activeIndicators.squeeze;
  const showStochRsiPanel = activeIndicators.stochRsi;

  // ── Fetch History ──
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/candles?asset=${encodeURIComponent(asset)}&timeframe=${timeframe}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to fetch history');
        setCandles(data.result || []);
      } catch (err) {
        console.error(err);
        setError('Error loading historical chart data.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [asset, timeframe, token]);

  // ── WebSocket Live Feed ──
  useEffect(() => {
    setWsStatus('connecting');
    const ws = new WebSocket("wss://socket.india.delta.exchange");
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      ws.send(JSON.stringify({
        type: "subscribe",
        payload: {
          channels: [{ name: "v2/ticker", symbols: [deltaSymbol] }]
        }
      }));
      ws.send(JSON.stringify({
        type: "subscribe",
        payload: {
          channels: [{ name: `candlestick_${timeframe}`, symbols: [deltaSymbol] }]
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!message) return;

        if (message.type === 'v2/ticker' && message.symbol === deltaSymbol) {
          setTicker(message);
        }

        if (message.type === `candlestick_${timeframe}` && message.symbol === deltaSymbol) {
          const candleStart = message.candle_start_time / 1000000;
          setCandles(prev => {
            if (prev.length === 0) return prev;
            const existingIdx = prev.findIndex(c => c.time === candleStart);
            if (existingIdx !== -1) {
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                open: Number(message.open),
                high: Number(message.high),
                low: Number(message.low),
                close: Number(message.close),
                volume: Number(message.volume)
              };
              return updated;
            } else {
              const newCandle = {
                time: candleStart,
                open: Number(message.open),
                high: Number(message.high),
                low: Number(message.low),
                close: Number(message.close),
                volume: Number(message.volume)
              };
              return [...prev.slice(1), newCandle];
            }
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    ws.onclose = () => setWsStatus('disconnected');
    ws.onerror = () => setWsStatus('error');

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [deltaSymbol, timeframe]);

  // ═════════════════════════════════════
  // CREATE PRIMARY CHART + ALL OVERLAY SERIES
  // ═════════════════════════════════════
  useEffect(() => {
    if (loading || error || candles.length === 0 || !chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 380,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: { mode: 1 },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        autoScale: true,
      }
    });
    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    // ── Standard Overlays ──
    ema20SeriesRef.current = chart.addSeries(LineSeries, {
      color: settings.ema20.color, lineWidth: settings.ema20.width, title: 'EMA 20', visible: activeIndicators.ema20,
    });
    ema50SeriesRef.current = chart.addSeries(LineSeries, {
      color: settings.ema50.color, lineWidth: settings.ema50.width, title: 'EMA 50', visible: activeIndicators.ema50,
    });

    // BB
    bbUpperSeriesRef.current = chart.addSeries(LineSeries, {
      color: settings.bb.color, lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Upper', visible: activeIndicators.bb,
    });
    bbLowerSeriesRef.current = chart.addSeries(LineSeries, {
      color: settings.bb.color, lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Lower', visible: activeIndicators.bb,
    });
    bbBasisSeriesRef.current = chart.addSeries(LineSeries, {
      color: settings.bb.color, lineWidth: 1, title: 'BB Basis', visible: activeIndicators.bb,
    });

    // ── VWAP ──
    vwapSeriesRef.current = chart.addSeries(LineSeries, {
      color: settings.vwap.color, lineWidth: 2, title: 'VWAP', visible: activeIndicators.vwap,
    });
    vwapUpper1Ref.current = chart.addSeries(LineSeries, {
      color: settings.vwap.bandColor, lineWidth: 1, lineStyle: LineStyle.Dashed, title: '', visible: activeIndicators.vwap,
    });
    vwapLower1Ref.current = chart.addSeries(LineSeries, {
      color: settings.vwap.bandColor, lineWidth: 1, lineStyle: LineStyle.Dashed, title: '', visible: activeIndicators.vwap,
    });
    vwapUpper2Ref.current = chart.addSeries(LineSeries, {
      color: settings.vwap.bandColor, lineWidth: 1, lineStyle: LineStyle.Dotted, title: '', visible: activeIndicators.vwap,
    });
    vwapLower2Ref.current = chart.addSeries(LineSeries, {
      color: settings.vwap.bandColor, lineWidth: 1, lineStyle: LineStyle.Dotted, title: '', visible: activeIndicators.vwap,
    });

    // ── Ichimoku ──
    ichimokuTenkanRef.current = chart.addSeries(LineSeries, {
      color: '#2563eb', lineWidth: 1, title: 'Tenkan', visible: activeIndicators.ichimoku,
    });
    ichimokuKijunRef.current = chart.addSeries(LineSeries, {
      color: '#dc2626', lineWidth: 1, title: 'Kijun', visible: activeIndicators.ichimoku,
    });
    ichimokuSpanARef.current = chart.addSeries(LineSeries, {
      color: 'rgba(16, 185, 129, 0.5)', lineWidth: 1, title: 'Span A', visible: activeIndicators.ichimoku,
    });
    ichimokuSpanBRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(239, 68, 68, 0.5)', lineWidth: 1, title: 'Span B', visible: activeIndicators.ichimoku,
    });

    // ── Supertrend ──
    supertrendRef.current = chart.addSeries(LineSeries, {
      color: '#10b981', lineWidth: 2, title: 'Supertrend', visible: activeIndicators.supertrend,
    });

    // ── Nadaraya-Watson ──
    nwSmoothedRef.current = chart.addSeries(LineSeries, {
      color: settings.nw.color, lineWidth: 2, title: 'NW Kernel', visible: activeIndicators.nw,
    });
    nwUpperRef.current = chart.addSeries(LineSeries, {
      color: settings.nw.envelopeColor, lineWidth: 1, lineStyle: LineStyle.Dashed, title: '', visible: activeIndicators.nw,
    });
    nwLowerRef.current = chart.addSeries(LineSeries, {
      color: settings.nw.envelopeColor, lineWidth: 1, lineStyle: LineStyle.Dashed, title: '', visible: activeIndicators.nw,
    });

    // ── ATR Trailing Stop ──
    atrStopRef.current = chart.addSeries(LineSeries, {
      color: 'transparent', lineWidth: 2, crosshairMarkerVisible: false, title: 'ATR Stop', visible: activeIndicators.atrStop,
    });

    aiForecastRef.current = chart.addSeries(LineSeries, {
      color: settings.aiForecast.color, lineStyle: LineStyle.Dashed, lineWidth: 2, title: 'AI Forecast', visible: activeIndicators.aiForecast,
    });

    // ── Resize Handler ──
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
      bbBasisSeriesRef.current = null;
      vwapSeriesRef.current = null;
      vwapUpper1Ref.current = null;
      vwapLower1Ref.current = null;
      vwapUpper2Ref.current = null;
      vwapLower2Ref.current = null;
      ichimokuTenkanRef.current = null;
      ichimokuKijunRef.current = null;
      ichimokuSpanARef.current = null;
      ichimokuSpanBRef.current = null;
      supertrendRef.current = null;
      nwSmoothedRef.current = null;
      nwUpperRef.current = null;
      nwLowerRef.current = null;
      atrStopRef.current = null;
      aiForecastRef.current = null;
      pineSeriesRefs.current = {};
      priceLinesRef.current = [];
      candleMarkersRef.current = null;
    };
  }, [loading, error, deltaSymbol, timeframe]);

  // ═════════════════════════════════════
  // CREATE RSI PANEL
  // ═════════════════════════════════════
  useEffect(() => {
    if (!showRsiPanel || !rsiContainerRef.current || !chartRef.current) return;

    const rsiChart = createChart(rsiContainerRef.current, {
      width: rsiContainerRef.current.clientWidth,
      height: 120,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.02)' }, horzLines: { color: 'rgba(255, 255, 255, 0.02)' } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.08)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.08)' }
    });
    rsiChartRef.current = rsiChart;

    const rsiSeries = rsiChart.addSeries(LineSeries, { color: settings.rsi.color, lineWidth: 1.5, title: 'RSI' });
    rsiSeriesRef.current = rsiSeries;

    rsiSeries.createPriceLine({ price: 70, color: 'rgba(239, 68, 68, 0.3)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'OB' });
    rsiSeries.createPriceLine({ price: 50, color: 'rgba(255, 255, 255, 0.1)', lineWidth: 1, title: '' });
    rsiSeries.createPriceLine({ price: 30, color: 'rgba(16, 185, 129, 0.3)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'OS' });

    const handleResize = () => {
      if (rsiChartRef.current && rsiContainerRef.current) {
        rsiChartRef.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      rsiChart.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, [showRsiPanel, loading, error, deltaSymbol, timeframe]);

  // ═════════════════════════════════════
  // CREATE MACD PANEL
  // ═════════════════════════════════════
  useEffect(() => {
    if (!showMacdPanel || !macdContainerRef.current || !chartRef.current) return;

    const macdChart = createChart(macdContainerRef.current, {
      width: macdContainerRef.current.clientWidth,
      height: 130,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.02)' }, horzLines: { color: 'rgba(255, 255, 255, 0.02)' } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.08)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.08)' }
    });
    macdChartRef.current = macdChart;

    macdHistRef.current = macdChart.addSeries(HistogramSeries, {
      color: '#10b981', base: 0, priceFormat: { type: 'price', precision: 4 }
    });
    macdLineRef.current = macdChart.addSeries(LineSeries, {
      color: settings.macd.macdColor, lineWidth: 1.5, title: 'MACD'
    });
    macdSignalRef.current = macdChart.addSeries(LineSeries, {
      color: settings.macd.signalColor, lineWidth: 1.5, title: 'Signal'
    });

    const handleResize = () => {
      if (macdChartRef.current && macdContainerRef.current) {
        macdChartRef.current.applyOptions({ width: macdContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      macdChart.remove();
      macdChartRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    };
  }, [showMacdPanel, loading, error, deltaSymbol, timeframe]);

  // ═════════════════════════════════════
  // CREATE SQUEEZE MOMENTUM PANEL
  // ═════════════════════════════════════
  useEffect(() => {
    if (!showSqzPanel || !sqzContainerRef.current || !chartRef.current) return;

    const sqzChart = createChart(sqzContainerRef.current, {
      width: sqzContainerRef.current.clientWidth,
      height: 120,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.02)' }, horzLines: { color: 'rgba(255, 255, 255, 0.02)' } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.08)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.08)' }
    });
    sqzChartRef.current = sqzChart;

    sqzHistogramSeriesRef.current = sqzChart.addSeries(HistogramSeries, {
      color: '#10b981', base: 0, priceFormat: { type: 'price', precision: 4 }
    });
    sqzMidlineSeriesRef.current = sqzChart.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.15)', lineWidth: 1, title: ''
    });

    const handleResize = () => {
      if (sqzChartRef.current && sqzContainerRef.current) {
        sqzChartRef.current.applyOptions({ width: sqzContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      sqzChart.remove();
      sqzChartRef.current = null;
      sqzHistogramSeriesRef.current = null;
      sqzMidlineSeriesRef.current = null;
      sqzMarkersRef.current = null;
    };
  }, [showSqzPanel, loading, error, deltaSymbol, timeframe]);

  // ═════════════════════════════════════
  // CREATE STOCHASTIC RSI PANEL
  // ═════════════════════════════════════
  useEffect(() => {
    if (!showStochRsiPanel || !stochRsiContainerRef.current || !chartRef.current) return;

    const stochChart = createChart(stochRsiContainerRef.current, {
      width: stochRsiContainerRef.current.clientWidth,
      height: 120,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.02)' }, horzLines: { color: 'rgba(255, 255, 255, 0.02)' } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.08)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.08)' }
    });
    stochRsiChartRef.current = stochChart;

    stochKRef.current = stochChart.addSeries(LineSeries, {
      color: settings.stochRsi.kColor, lineWidth: 1.5, title: '%K'
    });
    stochDRef.current = stochChart.addSeries(LineSeries, {
      color: settings.stochRsi.dColor, lineWidth: 1.5, title: '%D'
    });

    stochKRef.current.createPriceLine({ price: 80, color: 'rgba(239, 68, 68, 0.3)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'OB' });
    stochKRef.current.createPriceLine({ price: 50, color: 'rgba(255, 255, 255, 0.07)', lineWidth: 1, title: '' });
    stochKRef.current.createPriceLine({ price: 20, color: 'rgba(16, 185, 129, 0.3)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'OS' });

    const handleResize = () => {
      if (stochRsiChartRef.current && stochRsiContainerRef.current) {
        stochRsiChartRef.current.applyOptions({ width: stochRsiContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      stochChart.remove();
      stochRsiChartRef.current = null;
      stochKRef.current = null;
      stochDRef.current = null;
    };
  }, [showStochRsiPanel, loading, error, deltaSymbol, timeframe]);

  // ═════════════════════════════════════
  // SYNC TIMESCALES ACROSS ALL PANELS
  // ═════════════════════════════════════
  useEffect(() => {
    if (!chartRef.current) return;

    const activeCharts = [chartRef.current];
    if (showRsiPanel && rsiChartRef.current) activeCharts.push(rsiChartRef.current);
    if (showMacdPanel && macdChartRef.current) activeCharts.push(macdChartRef.current);
    if (showSqzPanel && sqzChartRef.current) activeCharts.push(sqzChartRef.current);
    if (showStochRsiPanel && stochRsiChartRef.current) activeCharts.push(stochRsiChartRef.current);

    if (activeCharts.length < 2) return;

    let isUpdating = false;
    const cleanups = activeCharts.map((source, idx) => {
      const handler = (logicalRange) => {
        if (isUpdating) return;
        isUpdating = true;
        activeCharts.forEach((target, targetIdx) => {
          if (idx !== targetIdx) {
            target.timeScale().setVisibleLogicalRange(logicalRange);
          }
        });
        isUpdating = false;
      };
      source.timeScale().subscribeVisibleLogicalRangeChange(handler);
      return () => source.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
    });

    return () => cleanups.forEach(unsub => unsub());
  }, [showRsiPanel, showMacdPanel, showSqzPanel, showStochRsiPanel, loading, error]);

  // ═════════════════════════════════════════════════
  // MAIN DATA PIPELINE – Recalculate & Populate All
  // ═════════════════════════════════════════════════
  useEffect(() => {
    if (candles.length === 0 || !candleSeriesRef.current || !chartRef.current) return;

    const closePrices = candles.map(c => c.close);

    // ── Candle Data ──
    const candleData = candles.map(c => ({
      time: c.time, open: c.open, high: c.high, low: c.low, close: c.close
    }));
    candleSeriesRef.current.setData(candleData);

    // ── EMA 20 ──
    const ema20 = calculateEMA(closePrices, settings.ema20.period);
    if (ema20SeriesRef.current) {
      ema20SeriesRef.current.setData(candles.map((c, i) => ({ time: c.time, value: ema20[i] })).filter(d => d.value !== null));
      ema20SeriesRef.current.applyOptions({ color: settings.ema20.color, lineWidth: settings.ema20.width, visible: activeIndicators.ema20, title: activeIndicators.ema20 ? 'EMA 20' : '' });
    }

    // ── EMA 50 ──
    const ema50 = calculateEMA(closePrices, settings.ema50.period);
    if (ema50SeriesRef.current) {
      ema50SeriesRef.current.setData(candles.map((c, i) => ({ time: c.time, value: ema50[i] })).filter(d => d.value !== null));
      ema50SeriesRef.current.applyOptions({ color: settings.ema50.color, lineWidth: settings.ema50.width, visible: activeIndicators.ema50, title: activeIndicators.ema50 ? 'EMA 50' : '' });
    }

    // ── Bollinger Bands ──
    const bb = calculateBollingerBands(closePrices, settings.bb.period, settings.bb.multiplier);
    if (bbUpperSeriesRef.current && bbLowerSeriesRef.current && bbBasisSeriesRef.current) {
      bbUpperSeriesRef.current.setData(candles.map((c, i) => ({ time: c.time, value: bb.upper[i] })).filter(d => d.value !== null));
      bbLowerSeriesRef.current.setData(candles.map((c, i) => ({ time: c.time, value: bb.lower[i] })).filter(d => d.value !== null));
      bbBasisSeriesRef.current.setData(candles.map((c, i) => ({ time: c.time, value: bb.basis[i] })).filter(d => d.value !== null));
      const bbOpts = { color: settings.bb.color, visible: activeIndicators.bb };
      bbUpperSeriesRef.current.applyOptions({ ...bbOpts, title: activeIndicators.bb ? 'BB Upper' : '' });
      bbLowerSeriesRef.current.applyOptions({ ...bbOpts, title: activeIndicators.bb ? 'BB Lower' : '' });
      bbBasisSeriesRef.current.applyOptions({ ...bbOpts, title: activeIndicators.bb ? 'BB Basis' : '' });
    }

    // ══ PREMIUM: VWAP ══
    if (vwapSeriesRef.current) {
      const vwapData = calculateVWAP(candles, settings.vwap.showBands);
      vwapSeriesRef.current.setData(candles.map((c, i) => ({ time: c.time, value: vwapData.vwap[i] })).filter(d => d.value !== null));
      vwapSeriesRef.current.applyOptions({ color: settings.vwap.color, visible: activeIndicators.vwap, title: activeIndicators.vwap ? 'VWAP' : '' });

      if (vwapUpper1Ref.current && vwapLower1Ref.current) {
        vwapUpper1Ref.current.setData(candles.map((c, i) => ({ time: c.time, value: vwapData.upperBand1[i] })).filter(d => d.value !== null));
        vwapLower1Ref.current.setData(candles.map((c, i) => ({ time: c.time, value: vwapData.lowerBand1[i] })).filter(d => d.value !== null));
        vwapUpper1Ref.current.applyOptions({ visible: activeIndicators.vwap });
        vwapLower1Ref.current.applyOptions({ visible: activeIndicators.vwap });
      }
      if (vwapUpper2Ref.current && vwapLower2Ref.current) {
        vwapUpper2Ref.current.setData(candles.map((c, i) => ({ time: c.time, value: vwapData.upperBand2[i] })).filter(d => d.value !== null));
        vwapLower2Ref.current.setData(candles.map((c, i) => ({ time: c.time, value: vwapData.lowerBand2[i] })).filter(d => d.value !== null));
        vwapUpper2Ref.current.applyOptions({ visible: activeIndicators.vwap });
        vwapLower2Ref.current.applyOptions({ visible: activeIndicators.vwap });
      }
    }

    // ══ PREMIUM: ICHIMOKU CLOUD ══
    if (ichimokuTenkanRef.current) {
      const ichi = calculateIchimoku(candles, settings.ichimoku.tenkan, settings.ichimoku.kijun, settings.ichimoku.senkouB, settings.ichimoku.displacement);
      ichimokuTenkanRef.current.setData(candles.map((c, i) => ({ time: c.time, value: ichi.tenkan[i] })).filter(d => d.value !== null));
      ichimokuKijunRef.current.setData(candles.map((c, i) => ({ time: c.time, value: ichi.kijun[i] })).filter(d => d.value !== null));
      ichimokuSpanARef.current.setData(candles.map((c, i) => ({ time: c.time, value: ichi.senkouA[i] })).filter(d => d.value !== null));
      ichimokuSpanBRef.current.setData(candles.map((c, i) => ({ time: c.time, value: ichi.senkouB[i] })).filter(d => d.value !== null));

      const ichiVis = activeIndicators.ichimoku;
      ichimokuTenkanRef.current.applyOptions({ visible: ichiVis, title: ichiVis ? 'Tenkan' : '' });
      ichimokuKijunRef.current.applyOptions({ visible: ichiVis, title: ichiVis ? 'Kijun' : '' });
      ichimokuSpanARef.current.applyOptions({ visible: ichiVis, title: ichiVis ? 'Span A' : '' });
      ichimokuSpanBRef.current.applyOptions({ visible: ichiVis, title: ichiVis ? 'Span B' : '' });
    }

    // ══ PREMIUM: SUPERTREND ══
    if (supertrendRef.current) {
      const st = calculateSupertrend(candles, settings.supertrend.period, settings.supertrend.multiplier);
      const stData = candles.map((c, i) => {
        if (st.supertrend[i] === null) return null;
        return { time: c.time, value: st.supertrend[i], color: st.direction[i] === 1 ? settings.supertrend.upColor : settings.supertrend.downColor };
      }).filter(d => d !== null);
      supertrendRef.current.setData(stData);
      supertrendRef.current.applyOptions({ visible: activeIndicators.supertrend, title: activeIndicators.supertrend ? 'Supertrend' : '' });
    }

    // ══ PREMIUM: NADARAYA-WATSON ENVELOPE ══
    if (nwSmoothedRef.current) {
      const nw = calculateNadarayaWatson(closePrices, settings.nw.bandwidth, settings.nw.multiplier);
      nwSmoothedRef.current.setData(candles.map((c, i) => ({ time: c.time, value: nw.smoothed[i] })).filter(d => d.value !== null));
      nwUpperRef.current.setData(candles.map((c, i) => ({ time: c.time, value: nw.upper[i] })).filter(d => d.value !== null));
      nwLowerRef.current.setData(candles.map((c, i) => ({ time: c.time, value: nw.lower[i] })).filter(d => d.value !== null));
      nwSmoothedRef.current.applyOptions({ color: settings.nw.color, visible: activeIndicators.nw, title: activeIndicators.nw ? 'NW Kernel' : '' });
      nwUpperRef.current.applyOptions({ visible: activeIndicators.nw });
      nwLowerRef.current.applyOptions({ visible: activeIndicators.nw });
    }

    // ══ PREMIUM: ATR TRAILING STOP ══
    if (atrStopRef.current) {
      const atrStop = calculateATRTrailingStop(candles, settings.atrStop.period, settings.atrStop.multiplier);
      const atrData = candles.map((c, i) => {
        if (atrStop.stopLine[i] === null) return null;
        return { time: c.time, value: atrStop.stopLine[i], color: atrStop.trailDir[i] === 1 ? settings.atrStop.longColor : settings.atrStop.shortColor };
      }).filter(d => d !== null);
      atrStopRef.current.setData(atrData);
      atrStopRef.current.applyOptions({ visible: activeIndicators.atrStop, title: activeIndicators.atrStop ? 'ATR Stop' : '' });
    }

    // ══ AI FORECAST (KNN) ══
    if (aiForecastRef.current) {
      if (activeIndicators.aiForecast) {
        const { projection } = calculateKNNProjection(candles, settings.aiForecast.lookback, settings.aiForecast.forward, settings.aiForecast.k);
        if (projection.length > 0) {
          const forecastData = [];
          const lastCandle = candles[candles.length - 1];
          // We need a time interval to step forward. Assume interval based on timeframe string roughly
          let tfSeconds = 60; // default 1m
          if (timeframe === '5m') tfSeconds = 300;
          if (timeframe === '15m') tfSeconds = 900;
          if (timeframe === '1h') tfSeconds = 3600;
          if (timeframe === '4h') tfSeconds = 14400;
          if (timeframe === '1d') tfSeconds = 86400;
          
          for (let f = 0; f <= settings.aiForecast.forward; f++) {
            forecastData.push({
              time: lastCandle.time + (f * tfSeconds),
              value: projection[f]
            });
          }
          aiForecastRef.current.setData(forecastData);
        }
      }
      aiForecastRef.current.applyOptions({ visible: activeIndicators.aiForecast, title: activeIndicators.aiForecast ? 'AI Forecast' : '' });
    }

    // ── RSI Panel ──
    const rsi = calculateRSI(closePrices, settings.rsi.period);
    if (showRsiPanel && rsiSeriesRef.current) {
      rsiSeriesRef.current.setData(candles.map((c, i) => ({ time: c.time, value: rsi[i] })).filter(d => d.value !== null));
      rsiSeriesRef.current.applyOptions({ color: settings.rsi.color });
    }

    // ══ PREMIUM: MACD Panel ══
    if (showMacdPanel && macdLineRef.current && macdSignalRef.current && macdHistRef.current) {
      const macd = calculateMACD(closePrices, settings.macd.fast, settings.macd.slow, settings.macd.signal);
      macdLineRef.current.setData(candles.map((c, i) => ({ time: c.time, value: macd.macdLine[i] })).filter(d => d.value !== null));
      macdSignalRef.current.setData(candles.map((c, i) => ({ time: c.time, value: macd.signal[i] })).filter(d => d.value !== null));
      
      const histData = [];
      for (let i = 0; i < candles.length; i++) {
        if (macd.histogram[i] === null) continue;
        histData.push({
          time: candles[i].time,
          value: macd.histogram[i],
          color: macd.histogram[i] >= 0
            ? (i > 0 && macd.histogram[i - 1] !== null && macd.histogram[i] >= macd.histogram[i - 1] ? '#10b981' : '#047857')
            : (i > 0 && macd.histogram[i - 1] !== null && macd.histogram[i] <= macd.histogram[i - 1] ? '#ef4444' : '#b91c1c')
        });
      }
      macdHistRef.current.setData(histData);
      macdLineRef.current.applyOptions({ color: settings.macd.macdColor });
      macdSignalRef.current.applyOptions({ color: settings.macd.signalColor });
    }

    // ── Squeeze Momentum Panel ──
    if (showSqzPanel && sqzHistogramSeriesRef.current && sqzMidlineSeriesRef.current) {
      const sqz = calculateSqueezeMomentum(candles, settings.squeeze.length, settings.squeeze.mult, settings.squeeze.lengthKC, settings.squeeze.multKC);

      const histData = [];
      for (let i = 0; i < candles.length; i++) {
        const val = sqz.histogram[i];
        if (val === null || val === undefined) continue;
        let barColor = '#10b981';
        if (val >= 0) {
          const prev = i > 0 ? sqz.histogram[i - 1] : 0;
          barColor = val >= (prev || 0) ? '#10b981' : '#047857';
        } else {
          const prev = i > 0 ? sqz.histogram[i - 1] : 0;
          barColor = val <= (prev || 0) ? '#ef4444' : '#b91c1c';
        }
        histData.push({ time: candles[i].time, value: val, color: barColor });
      }
      sqzHistogramSeriesRef.current.setData(histData);
      sqzMidlineSeriesRef.current.setData(candles.map(c => ({ time: c.time, value: 0 })));

      const midlineMarkers = [];
      for (let i = 0; i < candles.length; i++) {
        if (sqz.squeezeOn[i] === null || sqz.squeezeOn[i] === undefined) continue;
        midlineMarkers.push({
          time: candles[i].time, position: 'inBar',
          color: sqz.squeezeOn[i] ? '#ef4444' : '#10b981',
          shape: 'circle', size: 0.2
        });
      }
      if (!sqzMarkersRef.current) {
        sqzMarkersRef.current = createSeriesMarkers(sqzMidlineSeriesRef.current, []);
      }
      sqzMarkersRef.current.setMarkers(midlineMarkers);
    }

    // ══ PREMIUM: STOCHASTIC RSI Panel ══
    if (showStochRsiPanel && stochKRef.current && stochDRef.current) {
      const stochRsi = calculateStochRSI(closePrices, settings.stochRsi.rsiLen, settings.stochRsi.stochLen, settings.stochRsi.kSmooth, settings.stochRsi.dSmooth);
      stochKRef.current.setData(candles.map((c, i) => ({ time: c.time, value: stochRsi.k[i] })).filter(d => d.value !== null));
      stochDRef.current.setData(candles.map((c, i) => ({ time: c.time, value: stochRsi.d[i] })).filter(d => d.value !== null));
      stochKRef.current.applyOptions({ color: settings.stochRsi.kColor });
      stochDRef.current.applyOptions({ color: settings.stochRsi.dColor });
    }

    // ── Pine Script ──
    const pineResult = parseAndExecutePine(pineScript, candles);
    setPineErrors(pineResult.errors);
    setPinePlots(pineResult.plots);

    const activePlots = new Set(pineResult.plots.map(p => p.title));
    Object.keys(pineSeriesRefs.current).forEach(title => {
      if (!activePlots.has(title)) {
        chartRef.current.removeSeries(pineSeriesRefs.current[title]);
        delete pineSeriesRefs.current[title];
      }
    });
    pineResult.plots.forEach(plot => {
      if (!pineSeriesRefs.current[plot.title]) {
        pineSeriesRefs.current[plot.title] = chartRef.current.addSeries(LineSeries, {
          color: plot.color, lineWidth: 1.8, title: plot.title
        });
      }
      pineSeriesRefs.current[plot.title].setData(candles.map((c, i) => ({ time: c.time, value: plot.series[i] })).filter(d => d.value !== null));
    });

    // ═══ MARKERS (SMC + Liquidity + Divergence) ═══
    priceLinesRef.current.forEach(line => {
      try { candleSeriesRef.current.removePriceLine(line); } catch (e) { /* no-op */ }
    });
    priceLinesRef.current = [];

    const allMarkers = [];

    // SMC Structure
    if (activeIndicators.smc) {
      const smc = detectSMC(candles, settings);

      smc.swings.forEach(sw => {
        allMarkers.push({
          time: candles[sw.index].time,
          position: sw.type === 'high' ? 'aboveBar' : 'belowBar',
          color: sw.type === 'high' ? '#3b82f6' : '#ec4899',
          shape: sw.type === 'high' ? 'arrowDown' : 'arrowUp',
          text: sw.type === 'high' ? 'SH' : 'SL'
        });
      });

      smc.breaks.forEach(br => {
        const line = candleSeriesRef.current.createPriceLine({
          price: br.price,
          color: br.type === 'bullish' ? '#10b981' : '#ef4444',
          lineStyle: LineStyle.Dashed, lineWidth: 1, title: br.label
        });
        priceLinesRef.current.push(line);
      });

      smc.fvgs.forEach(f => {
        const line = candleSeriesRef.current.createPriceLine({
          price: f.price,
          color: f.type === 'bullish' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
          lineStyle: LineStyle.Dotted, lineWidth: 1, title: f.label
        });
        priceLinesRef.current.push(line);
      });
    }

    // Liquidity Sweep markers
    if (activeIndicators.liqSweep) {
      const sweeps = detectLiquiditySweeps(candles, settings.liqSweep.lookback, settings.liqSweep.threshold);
      sweeps.forEach(sw => {
        allMarkers.push({
          time: sw.time,
          position: sw.type === 'bearish' ? 'aboveBar' : 'belowBar',
          color: sw.type === 'bearish' ? '#f97316' : '#06b6d4',
          shape: sw.type === 'bearish' ? 'arrowDown' : 'arrowUp',
          text: sw.label
        });
      });
    }

    // Volume Profile POC/VAH/VAL lines
    if (activeIndicators.volProfile) {
      const vp = calculateVolumeProfile(candles, settings.volProfile.bins);
      if (vp.poc !== null) {
        const pocLine = candleSeriesRef.current.createPriceLine({
          price: vp.poc, color: settings.volProfile.pocColor,
          lineStyle: LineStyle.Solid, lineWidth: 2, title: 'POC'
        });
        priceLinesRef.current.push(pocLine);
      }
      if (vp.vah !== null) {
        const vahLine = candleSeriesRef.current.createPriceLine({
          price: vp.vah, color: 'rgba(59, 130, 246, 0.5)',
          lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'VAH'
        });
        priceLinesRef.current.push(vahLine);
      }
      if (vp.val !== null) {
        const valLine = candleSeriesRef.current.createPriceLine({
          price: vp.val, color: 'rgba(59, 130, 246, 0.5)',
          lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'VAL'
        });
        priceLinesRef.current.push(valLine);
      }
    }

    // RSI Divergence markers
    if (activeIndicators.divergence) {
      const divs = detectDivergences(candles, settings.divergence.rsiPeriod, settings.divergence.pivotLookback);
      divs.forEach(dv => {
        allMarkers.push({
          time: dv.time,
          position: dv.type === 'bullish' ? 'belowBar' : 'aboveBar',
          color: dv.type === 'bullish' ? '#10b981' : '#ef4444',
          shape: dv.type === 'bullish' ? 'arrowUp' : 'arrowDown',
          text: dv.label
        });
      });
    }

    // Sort markers by time (required by lightweight-charts)
    allMarkers.sort((a, b) => a.time - b.time);
    if (!candleMarkersRef.current) {
      candleMarkersRef.current = createSeriesMarkers(candleSeriesRef.current, []);
    }
    candleMarkersRef.current.setMarkers(allMarkers);

  }, [candles, pineScript, activeIndicators, settings, showRsiPanel, showMacdPanel, showSqzPanel, showStochRsiPanel]);

  // ── Handle Pine Script Apply ──
  const handleApplyScript = useCallback((script) => {
    setPineScript(script);
  }, []);

  // ── Derived Ticker Values ──
  const currentPrice = ticker?.close || (candles[candles.length - 1]?.close) || 0;
  const pctChange = ticker?.ltp_change_24h || 0;
  const high24h = ticker?.high || 0;
  const low24h = ticker?.low || 0;
  const volume24h = ticker?.volume || 0;
  const isUp = parseFloat(pctChange) >= 0;

  // Count active premium indicators
  const premiumKeys = ['vwap', 'ichimoku', 'supertrend', 'nw', 'atrStop', 'liqSweep', 'volProfile', 'divergence', 'macd', 'squeeze', 'stochRsi', 'smc', 'aiForecast'];
  const activePremiumCount = premiumKeys.filter(k => activeIndicators[k]).length;

  // ═══════════════════════════════
  // SETTINGS PANEL CONFIG SECTIONS
  // ═══════════════════════════════
  const renderSettingsSection = (key) => {
    const configs = {
      ema20: (
        <div className="settings-section">
          <h4>EMA 20</h4>
          <div className="settings-row"><label>Length</label>
            <input type="number" min="2" max="200" value={settings.ema20.period} onChange={e => updateSetting('ema20', 'period', Math.max(2, parseInt(e.target.value) || 2))} />
          </div>
          <div className="settings-row"><label>Color</label>
            <input type="color" value={settings.ema20.color} onChange={e => updateSetting('ema20', 'color', e.target.value)} />
          </div>
          <div className="settings-row"><label>Width</label>
            <input type="range" min="1" max="4" value={settings.ema20.width} onChange={e => updateSetting('ema20', 'width', parseInt(e.target.value))} />
          </div>
        </div>
      ),
      ema50: (
        <div className="settings-section">
          <h4>EMA 50</h4>
          <div className="settings-row"><label>Length</label>
            <input type="number" min="2" max="300" value={settings.ema50.period} onChange={e => updateSetting('ema50', 'period', Math.max(2, parseInt(e.target.value) || 2))} />
          </div>
          <div className="settings-row"><label>Color</label>
            <input type="color" value={settings.ema50.color} onChange={e => updateSetting('ema50', 'color', e.target.value)} />
          </div>
          <div className="settings-row"><label>Width</label>
            <input type="range" min="1" max="4" value={settings.ema50.width} onChange={e => updateSetting('ema50', 'width', parseInt(e.target.value))} />
          </div>
        </div>
      ),
      bb: (
        <div className="settings-section">
          <h4>Bollinger Bands</h4>
          <div className="settings-row"><label>Length</label>
            <input type="number" min="5" max="100" value={settings.bb.period} onChange={e => updateSetting('bb', 'period', Math.max(5, parseInt(e.target.value) || 5))} />
          </div>
          <div className="settings-row"><label>StdDev Mult</label>
            <input type="number" step="0.1" min="0.5" max="5" value={settings.bb.multiplier} onChange={e => updateSetting('bb', 'multiplier', Math.max(0.5, parseFloat(e.target.value) || 1))} />
          </div>
        </div>
      ),
      vwap: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> VWAP</h4>
          <div className="settings-row"><label>Show Bands</label>
            <input type="checkbox" checked={settings.vwap.showBands} onChange={e => updateSetting('vwap', 'showBands', e.target.checked)} />
          </div>
          <div className="settings-row"><label>Color</label>
            <input type="color" value={settings.vwap.color} onChange={e => updateSetting('vwap', 'color', e.target.value)} />
          </div>
        </div>
      ),
      ichimoku: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> Ichimoku Cloud</h4>
          <div className="settings-row"><label>Tenkan Period</label>
            <input type="number" min="5" max="50" value={settings.ichimoku.tenkan} onChange={e => updateSetting('ichimoku', 'tenkan', Math.max(5, parseInt(e.target.value) || 9))} />
          </div>
          <div className="settings-row"><label>Kijun Period</label>
            <input type="number" min="10" max="60" value={settings.ichimoku.kijun} onChange={e => updateSetting('ichimoku', 'kijun', Math.max(10, parseInt(e.target.value) || 26))} />
          </div>
          <div className="settings-row"><label>Senkou B Period</label>
            <input type="number" min="20" max="120" value={settings.ichimoku.senkouB} onChange={e => updateSetting('ichimoku', 'senkouB', Math.max(20, parseInt(e.target.value) || 52))} />
          </div>
          <div className="settings-row"><label>Displacement</label>
            <input type="number" min="10" max="60" value={settings.ichimoku.displacement} onChange={e => updateSetting('ichimoku', 'displacement', Math.max(10, parseInt(e.target.value) || 26))} />
          </div>
        </div>
      ),
      supertrend: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> Supertrend</h4>
          <div className="settings-row"><label>ATR Period</label>
            <input type="number" min="5" max="50" value={settings.supertrend.period} onChange={e => updateSetting('supertrend', 'period', Math.max(5, parseInt(e.target.value) || 10))} />
          </div>
          <div className="settings-row"><label>Multiplier</label>
            <input type="number" step="0.1" min="1" max="6" value={settings.supertrend.multiplier} onChange={e => updateSetting('supertrend', 'multiplier', Math.max(1, parseFloat(e.target.value) || 3))} />
          </div>
          <div className="settings-row"><label>Up Color</label>
            <input type="color" value={settings.supertrend.upColor} onChange={e => updateSetting('supertrend', 'upColor', e.target.value)} />
          </div>
          <div className="settings-row"><label>Down Color</label>
            <input type="color" value={settings.supertrend.downColor} onChange={e => updateSetting('supertrend', 'downColor', e.target.value)} />
          </div>
        </div>
      ),
      nw: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> Nadaraya-Watson</h4>
          <div className="settings-row"><label>Bandwidth (h)</label>
            <input type="number" step="0.5" min="1" max="50" value={settings.nw.bandwidth} onChange={e => updateSetting('nw', 'bandwidth', Math.max(1, parseFloat(e.target.value) || 8))} />
          </div>
          <div className="settings-row"><label>Envelope Mult</label>
            <input type="number" step="0.1" min="1" max="6" value={settings.nw.multiplier} onChange={e => updateSetting('nw', 'multiplier', Math.max(1, parseFloat(e.target.value) || 3))} />
          </div>
          <div className="settings-row"><label>Kernel Color</label>
            <input type="color" value={settings.nw.color} onChange={e => updateSetting('nw', 'color', e.target.value)} />
          </div>
        </div>
      ),
      atrStop: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> ATR Trailing Stop</h4>
          <div className="settings-row"><label>ATR Period</label>
            <input type="number" min="5" max="50" value={settings.atrStop.period} onChange={e => updateSetting('atrStop', 'period', Math.max(5, parseInt(e.target.value) || 22))} />
          </div>
          <div className="settings-row"><label>Multiplier</label>
            <input type="number" step="0.1" min="1" max="6" value={settings.atrStop.multiplier} onChange={e => updateSetting('atrStop', 'multiplier', Math.max(1, parseFloat(e.target.value) || 3))} />
          </div>
          <div className="settings-row"><label>Long Color</label>
            <input type="color" value={settings.atrStop.longColor} onChange={e => updateSetting('atrStop', 'longColor', e.target.value)} />
          </div>
          <div className="settings-row"><label>Short Color</label>
            <input type="color" value={settings.atrStop.shortColor} onChange={e => updateSetting('atrStop', 'shortColor', e.target.value)} />
          </div>
        </div>
      ),
      aiForecast: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> AI Forecast (KNN)</h4>
          <div className="settings-row"><label>Lookback Pattern</label>
            <input type="number" min="5" max="50" value={settings.aiForecast.lookback} onChange={e => updateSetting('aiForecast', 'lookback', Math.max(5, parseInt(e.target.value) || 14))} />
          </div>
          <div className="settings-row"><label>Forward Projection</label>
            <input type="number" min="3" max="50" value={settings.aiForecast.forward} onChange={e => updateSetting('aiForecast', 'forward', Math.max(3, parseInt(e.target.value) || 10))} />
          </div>
          <div className="settings-row"><label>K Neighbors</label>
            <input type="number" min="1" max="20" value={settings.aiForecast.k} onChange={e => updateSetting('aiForecast', 'k', Math.max(1, parseInt(e.target.value) || 5))} />
          </div>
          <div className="settings-row"><label>Line Color</label>
            <input type="color" value={settings.aiForecast.color} onChange={e => updateSetting('aiForecast', 'color', e.target.value)} />
          </div>
        </div>
      ),
      smc: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> SMC Structure</h4>
          <div className="settings-row"><label>Swing Lookback</label>
            <input type="number" min="2" max="15" value={settings.smc.swingLookback} onChange={e => updateSetting('smc', 'swingLookback', Math.max(2, parseInt(e.target.value) || 4))} />
          </div>
          <div className="settings-row"><label>Show FVG</label>
            <input type="checkbox" checked={settings.smc.showFVG} onChange={e => updateSetting('smc', 'showFVG', e.target.checked)} />
          </div>
          <div className="settings-row"><label>Show BOS</label>
            <input type="checkbox" checked={settings.smc.showBOS} onChange={e => updateSetting('smc', 'showBOS', e.target.checked)} />
          </div>
        </div>
      ),
      liqSweep: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> Liquidity Sweeps</h4>
          <div className="settings-row"><label>Lookback</label>
            <input type="number" min="5" max="30" value={settings.liqSweep.lookback} onChange={e => updateSetting('liqSweep', 'lookback', Math.max(5, parseInt(e.target.value) || 10))} />
          </div>
          <div className="settings-row"><label>Threshold</label>
            <input type="number" step="0.05" min="0.05" max="1" value={settings.liqSweep.threshold} onChange={e => updateSetting('liqSweep', 'threshold', Math.max(0.05, parseFloat(e.target.value) || 0.3))} />
          </div>
        </div>
      ),
      volProfile: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> Volume Profile</h4>
          <div className="settings-row"><label>Bins</label>
            <input type="number" min="10" max="50" value={settings.volProfile.bins} onChange={e => updateSetting('volProfile', 'bins', Math.max(10, parseInt(e.target.value) || 24))} />
          </div>
          <div className="settings-row"><label>POC Color</label>
            <input type="color" value={settings.volProfile.pocColor} onChange={e => updateSetting('volProfile', 'pocColor', e.target.value)} />
          </div>
        </div>
      ),
      divergence: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> RSI Divergences</h4>
          <div className="settings-row"><label>RSI Period</label>
            <input type="number" min="5" max="30" value={settings.divergence.rsiPeriod} onChange={e => updateSetting('divergence', 'rsiPeriod', Math.max(5, parseInt(e.target.value) || 14))} />
          </div>
          <div className="settings-row"><label>Pivot Lookback</label>
            <input type="number" min="3" max="15" value={settings.divergence.pivotLookback} onChange={e => updateSetting('divergence', 'pivotLookback', Math.max(3, parseInt(e.target.value) || 5))} />
          </div>
        </div>
      ),
      rsi: (
        <div className="settings-section">
          <h4>RSI</h4>
          <div className="settings-row"><label>Length</label>
            <input type="number" min="2" value={settings.rsi.period} onChange={e => updateSetting('rsi', 'period', Math.max(2, parseInt(e.target.value) || 14))} />
          </div>
          <div className="settings-row"><label>Color</label>
            <input type="color" value={settings.rsi.color} onChange={e => updateSetting('rsi', 'color', e.target.value)} />
          </div>
        </div>
      ),
      macd: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> MACD</h4>
          <div className="settings-row"><label>Fast EMA</label>
            <input type="number" min="2" max="50" value={settings.macd.fast} onChange={e => updateSetting('macd', 'fast', Math.max(2, parseInt(e.target.value) || 12))} />
          </div>
          <div className="settings-row"><label>Slow EMA</label>
            <input type="number" min="10" max="100" value={settings.macd.slow} onChange={e => updateSetting('macd', 'slow', Math.max(10, parseInt(e.target.value) || 26))} />
          </div>
          <div className="settings-row"><label>Signal Smoothing</label>
            <input type="number" min="2" max="30" value={settings.macd.signal} onChange={e => updateSetting('macd', 'signal', Math.max(2, parseInt(e.target.value) || 9))} />
          </div>
          <div className="settings-row"><label>MACD Color</label>
            <input type="color" value={settings.macd.macdColor} onChange={e => updateSetting('macd', 'macdColor', e.target.value)} />
          </div>
          <div className="settings-row"><label>Signal Color</label>
            <input type="color" value={settings.macd.signalColor} onChange={e => updateSetting('macd', 'signalColor', e.target.value)} />
          </div>
        </div>
      ),
      squeeze: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> Squeeze Momentum</h4>
          <div className="settings-row"><label>BB Length</label>
            <input type="number" min="5" value={settings.squeeze.length} onChange={e => updateSetting('squeeze', 'length', Math.max(5, parseInt(e.target.value) || 20))} />
          </div>
          <div className="settings-row"><label>BB Mult</label>
            <input type="number" step="0.1" value={settings.squeeze.mult} onChange={e => updateSetting('squeeze', 'mult', parseFloat(e.target.value) || 2.0)} />
          </div>
          <div className="settings-row"><label>KC Length</label>
            <input type="number" min="5" value={settings.squeeze.lengthKC} onChange={e => updateSetting('squeeze', 'lengthKC', Math.max(5, parseInt(e.target.value) || 20))} />
          </div>
          <div className="settings-row"><label>KC Mult</label>
            <input type="number" step="0.1" value={settings.squeeze.multKC} onChange={e => updateSetting('squeeze', 'multKC', parseFloat(e.target.value) || 1.5)} />
          </div>
        </div>
      ),
      stochRsi: (
        <div className="settings-section">
          <h4><span className="premium-badge">PRO</span> Stochastic RSI</h4>
          <div className="settings-row"><label>RSI Length</label>
            <input type="number" min="5" max="30" value={settings.stochRsi.rsiLen} onChange={e => updateSetting('stochRsi', 'rsiLen', Math.max(5, parseInt(e.target.value) || 14))} />
          </div>
          <div className="settings-row"><label>Stoch Length</label>
            <input type="number" min="5" max="30" value={settings.stochRsi.stochLen} onChange={e => updateSetting('stochRsi', 'stochLen', Math.max(5, parseInt(e.target.value) || 14))} />
          </div>
          <div className="settings-row"><label>%K Smoothing</label>
            <input type="number" min="1" max="10" value={settings.stochRsi.kSmooth} onChange={e => updateSetting('stochRsi', 'kSmooth', Math.max(1, parseInt(e.target.value) || 3))} />
          </div>
          <div className="settings-row"><label>%D Smoothing</label>
            <input type="number" min="1" max="10" value={settings.stochRsi.dSmooth} onChange={e => updateSetting('stochRsi', 'dSmooth', Math.max(1, parseInt(e.target.value) || 3))} />
          </div>
          <div className="settings-row"><label>%K Color</label>
            <input type="color" value={settings.stochRsi.kColor} onChange={e => updateSetting('stochRsi', 'kColor', e.target.value)} />
          </div>
          <div className="settings-row"><label>%D Color</label>
            <input type="color" value={settings.stochRsi.dColor} onChange={e => updateSetting('stochRsi', 'dColor', e.target.value)} />
          </div>
        </div>
      ),
    };

    return configs[key] || null;
  };

  return (
    <div className="live-chart-container animate-fade-in">
      {/* ── Metric Bar / Header ── */}
      <div className="chart-metrics-bar glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={`ws-status-dot ${wsStatus}`} />
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Live Connection</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'Outfit' }}>
              {deltaSymbol} · {timeframe}
            </div>
          </div>
        </div>

        <div className="metric-ticker">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current Price</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="price-primary">${currentPrice?.toLocaleString()}</span>
            <span className={`price-pct ${isUp ? 'positive' : 'negative'}`}>
              {isUp ? <TrendingUp size={12} style={{ marginRight: 2 }} /> : <TrendingDown size={12} style={{ marginRight: 2 }} />}
              {isUp ? '+' : ''}{pctChange}%
            </span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-lbl">24H High</div>
          <div className="metric-val">${high24h?.toLocaleString() || '-'}</div>
        </div>

        <div className="metric-box">
          <div className="metric-lbl">24H Low</div>
          <div className="metric-val">${low24h?.toLocaleString() || '-'}</div>
        </div>

        <div className="metric-box">
          <div className="metric-lbl">24H Volume</div>
          <div className="metric-val">{volume24h ? Number(volume24h).toFixed(2) : '-'}</div>
        </div>
      </div>

      {/* ── Premium Indicator Grid ── */}
      <div className="indicator-grid-panel glass-card">
        <div className="indicator-grid-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={15} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Technical Indicators</span>
            {activePremiumCount > 0 && (
              <span className="active-premium-count">{activePremiumCount} PRO active</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className="indicator-settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              title="Configure indicator settings"
            >
              <Sliders size={13} /> Settings
            </button>
            <button 
              className={`indicator-settings-btn console-btn ${showPineEditor ? 'active' : ''}`}
              onClick={() => setShowPineEditor(!showPineEditor)}
            >
              <Code size={13} /> Pine
            </button>
          </div>
        </div>

        <div className="indicator-categories">
          {Object.entries(INDICATOR_CATEGORIES).map(([catKey, cat]) => {
            const IconComp = cat.icon;
            return (
              <div key={catKey} className="indicator-category">
                <div className="category-label">
                  <IconComp size={12} /> {cat.label}
                </div>
                <div className="category-items">
                  {cat.items.map(item => (
                    <button
                      key={item.key}
                      className={`indicator-chip ${activeIndicators[item.key] ? 'active' : ''} ${item.premium ? 'premium' : ''}`}
                      onClick={() => toggleIndicator(item.key)}
                    >
                      {activeIndicators[item.key] ? <Eye size={11} /> : <EyeOff size={11} />}
                      {item.label}
                      {item.premium && <span className="chip-pro">PRO</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Chart Canvas Stack ── */}
      <div className="chart-wrapper-grid">
        <div className="chart-canvas-area glass-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {loading ? (
            <div className="chart-loader" style={{ height: 380, justifyContent: 'center' }}>
              <RefreshCw size={24} className="spinning" />
              <span>Fetching market candles...</span>
            </div>
          ) : error ? (
            <div className="chart-error" style={{ height: 380, justifyContent: 'center', display: 'flex', alignItems: 'center' }}>
              <span>{error}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
              {/* Primary Candlestick Chart */}
              <div ref={chartContainerRef} style={{ width: '100%', height: 380, position: 'relative' }} />
              
              {/* RSI Panel */}
              {showRsiPanel && (
                <div className="sub-panel-container">
                  <div className="sub-panel-label">RSI ({settings.rsi.period})</div>
                  <div ref={rsiContainerRef} style={{ width: '100%', height: 120 }} />
                </div>
              )}

              {/* MACD Panel */}
              {showMacdPanel && (
                <div className="sub-panel-container">
                  <div className="sub-panel-label">MACD ({settings.macd.fast},{settings.macd.slow},{settings.macd.signal})</div>
                  <div ref={macdContainerRef} style={{ width: '100%', height: 130 }} />
                </div>
              )}

              {/* Squeeze Momentum Panel */}
              {showSqzPanel && (
                <div className="sub-panel-container">
                  <div className="sub-panel-label">Squeeze Momentum</div>
                  <div ref={sqzContainerRef} style={{ width: '100%', height: 120 }} />
                </div>
              )}

              {/* Stochastic RSI Panel */}
              {showStochRsiPanel && (
                <div className="sub-panel-container">
                  <div className="sub-panel-label">Stochastic RSI (%K {settings.stochRsi.kSmooth}, %D {settings.stochRsi.dSmooth})</div>
                  <div ref={stochRsiContainerRef} style={{ width: '100%', height: 120 }} />
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Pine Editor */}
        {showPineEditor && (
          <PineEditor 
            onApplyScript={handleApplyScript} 
            scriptErrors={pineErrors} 
          />
        )}
      </div>

      {/* ── Settings Drawer ── */}
      {isSettingsOpen && (
        <div className="settings-drawer-overlay">
          <div className="settings-drawer glass-card animate-fade-in">
            <div className="settings-drawer-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} /> Indicator Configuration
              </h3>
              <button className="settings-close-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Tabbed navigation */}
            <div className="settings-tabs">
              {Object.entries(INDICATOR_CATEGORIES).map(([catKey, cat]) => {
                const IconComp = cat.icon;
                return (
                  <button
                    key={catKey}
                    className={`settings-tab ${activeSettingsTab === catKey ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab(catKey)}
                  >
                    <IconComp size={13} /> {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="settings-drawer-body">
              {INDICATOR_CATEGORIES[activeSettingsTab]?.items
                .filter(item => activeIndicators[item.key])
                .map(item => (
                  <React.Fragment key={item.key}>
                    {renderSettingsSection(item.key)}
                  </React.Fragment>
                ))
              }
              {INDICATOR_CATEGORIES[activeSettingsTab]?.items.filter(item => activeIndicators[item.key]).length === 0 && (
                <div className="settings-empty">
                  <EyeOff size={24} style={{ opacity: 0.3 }} />
                  <p>No active indicators in this category.</p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>Enable indicators from the panel above to configure them.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveChart;
