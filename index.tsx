
import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

// Constants
const TIME_POINTS = 24; // 24 hours
const MAX_POSSIBLE_SLIDER_DEMAND = 40; // Max for Y-axis scaling & slider

const DEMAND_PROFILES: Record<string, { name: string; data: number[] }> = {
  typicalSpiky: {
    name: "Typical Spiky",
    data: [5, 6, 7, 8, 10, 13, 16, 20, 23, 26, 24, 20, 18, 15, 12, 14, 17, 21, 24, 22, 19, 15, 10, 7],
  },
  sustainedHigh: {
    name: "Sustained High Usage",
    data: [8, 9, 10, 12, 15, 18, 22, 25, 25, 25, 25, 24, 23, 22, 20, 18, 15, 12, 10, 9, 8, 7, 6, 5],
  },
  sharpShortPeak: {
    name: "Sharp, Short Peak",
    data: [4, 4, 5, 5, 6, 7, 8, 30, 35, 30, 8, 7, 6, 5, 5, 4, 4, 5, 6, 7, 6, 5, 4, 4],
  },
  dualPeaks: {
    name: "Dual Peaks",
    data: [5, 6, 8, 12, 18, 22, 18, 12, 8, 6, 7, 9, 15, 20, 25, 20, 15, 9, 7, 6, 5, 4, 4, 3],
  },
  lowFlat: {
    name: "Low, Flat Usage",
    data: [3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 6, 5, 5, 4, 4, 3, 3, 3, 4, 4, 5, 5, 4, 3],
  }
};


const CHART_HEIGHT = 250;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 30;
const CHART_PADDING_LEFT = 30;
const CHART_PADDING_RIGHT = 10;
const USABLE_CHART_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

interface ChartProps {
  width: number;
  baseReservedCapacity: number; // This is the actual base reservation line shown on the chart
  isAssuredModel: boolean;
  demandData: number[];
  yAxisMax: number;
}

const SvgChart: React.FC<ChartProps> = ({ width, baseReservedCapacity, isAssuredModel, demandData, yAxisMax }) => {
  const usableWidth = width - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const xScale = usableWidth / (TIME_POINTS - 1);
  const yScale = USABLE_CHART_HEIGHT / yAxisMax;

  const getPath = (data: number[], fillToBottom: boolean = false, customMaxY?: number) => {
    let path = `M ${CHART_PADDING_LEFT},${CHART_PADDING_TOP + USABLE_CHART_HEIGHT - Math.min(data[0], yAxisMax) * yScale}`;
    data.forEach((point, i) => {
      if (i > 0) {
        path += ` L ${CHART_PADDING_LEFT + i * xScale},${CHART_PADDING_TOP + USABLE_CHART_HEIGHT - Math.min(point, customMaxY === undefined ? yAxisMax : customMaxY) * yScale}`;
      }
    });
    if (fillToBottom) {
      path += ` L ${CHART_PADDING_LEFT + (TIME_POINTS - 1) * xScale},${CHART_PADDING_TOP + USABLE_CHART_HEIGHT}`;
      path += ` L ${CHART_PADDING_LEFT},${CHART_PADDING_TOP + USABLE_CHART_HEIGHT} Z`;
    }
    return path;
  };
  
  const getAreaPath = (lowerDataPoints: number[], upperDataPoints: number[]) => {
    let path = `M ${CHART_PADDING_LEFT},${CHART_PADDING_TOP + USABLE_CHART_HEIGHT - Math.min(lowerDataPoints[0], yAxisMax) * yScale}`;
    lowerDataPoints.forEach((point, i) => {
        if (i > 0) path += ` L ${CHART_PADDING_LEFT + i * xScale},${CHART_PADDING_TOP + USABLE_CHART_HEIGHT - Math.min(point, yAxisMax) * yScale}`;
    });
    for (let i = upperDataPoints.length - 1; i >= 0; i--) {
        path += ` L ${CHART_PADDING_LEFT + i * xScale},${CHART_PADDING_TOP + USABLE_CHART_HEIGHT - Math.min(upperDataPoints[i], yAxisMax) * yScale}`;
    }
    path += " Z";
    return path;
  };

  const demandPath = getPath(demandData);
  const reservedLineY = CHART_PADDING_TOP + USABLE_CHART_HEIGHT - Math.min(baseReservedCapacity, yAxisMax) * yScale;
  
  const assuredCeilingCapacity = isAssuredModel ? baseReservedCapacity * 1.25 : baseReservedCapacity;
  const assuredLineY = CHART_PADDING_TOP + USABLE_CHART_HEIGHT - Math.min(assuredCeilingCapacity, yAxisMax) * yScale;


  const utilizedReservedPoints = demandData.map(d => Math.min(d, baseReservedCapacity));
  const utilizedReservedArea = getAreaPath(Array(TIME_POINTS).fill(0), utilizedReservedPoints);
  
  const idleReservedAreaPointsBase = demandData.map(d => Math.min(d, baseReservedCapacity));
  const idleReservedAreaPointsTop = Array(TIME_POINTS).fill(baseReservedCapacity);
  const idleReservedArea = getAreaPath(idleReservedAreaPointsBase, idleReservedAreaPointsTop);


  let unmetDemandArea = "";
  const unmetPoints = demandData.map(d => Math.max(0, d - assuredCeilingCapacity));
  const unmetBase = demandData.map(d => Math.min(d, assuredCeilingCapacity));
  if (unmetPoints.some(p => p > 0)) {
    unmetDemandArea = getAreaPath(unmetBase, demandData);
  }
  
  let utilizedOnDemandArea = "";
  if (isAssuredModel) {
      const onDemandStartPoints = demandData.map(d => Math.min(d, baseReservedCapacity)); 
      const onDemandEndPoints = demandData.map(d => Math.min(d, assuredCeilingCapacity)); 
      if (demandData.some((d, i) => onDemandEndPoints[i] > onDemandStartPoints[i])) {
        utilizedOnDemandArea = getAreaPath(onDemandStartPoints, onDemandEndPoints);
      }
  }

  const yAxisTicks = [];
  for (let i = 0; i <= yAxisMax; i += 5) {
      yAxisTicks.push(i);
  }

  return (
    <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} aria-labelledby={isAssuredModel ? "assuredChartTitle" : "traditionalChartTitle"} role="img">
      <title id={isAssuredModel ? "assuredChartTitle" : "traditionalChartTitle"}>
        GPU Usage Over Time ({isAssuredModel ? "Assured On-Demand Model" : "Traditional Model"})
      </title>
      {yAxisTicks.map(tick => (
        <g key={`y-tick-${tick}`}>
          <line
            className="grid-line"
            x1={CHART_PADDING_LEFT}
            y1={CHART_PADDING_TOP + USABLE_CHART_HEIGHT - tick * yScale}
            x2={width - CHART_PADDING_RIGHT}
            y2={CHART_PADDING_TOP + USABLE_CHART_HEIGHT - tick * yScale}
          />
          <text
            className="axis-text"
            x={CHART_PADDING_LEFT - 8}
            y={CHART_PADDING_TOP + USABLE_CHART_HEIGHT - tick * yScale + 3}
            textAnchor="end"
          >
            {tick}
          </text>
        </g>
      ))}
       <line className="axis-line" x1={CHART_PADDING_LEFT} y1={CHART_PADDING_TOP + USABLE_CHART_HEIGHT} x2={width - CHART_PADDING_RIGHT} y2={CHART_PADDING_TOP + USABLE_CHART_HEIGHT} />
      {[0, 6, 12, 18, 23].map(hour => (
        <text
          key={`x-label-${hour}`}
          className="axis-text"
          x={CHART_PADDING_LEFT + hour * xScale}
          y={CHART_PADDING_TOP + USABLE_CHART_HEIGHT + 15}
          textAnchor="middle"
        >
          {hour}h
        </text>
      ))}
       <text className="axis-text" x={CHART_PADDING_LEFT + (TIME_POINTS -1) * xScale / 2} y={CHART_PADDING_TOP + USABLE_CHART_HEIGHT + 28} textAnchor="middle">Time (Hours)</text>
       <text className="axis-text" x={CHART_PADDING_LEFT - 25} y={CHART_PADDING_TOP + USABLE_CHART_HEIGHT/2} textAnchor="middle" transform={`rotate(-90, ${CHART_PADDING_LEFT - 25}, ${CHART_PADDING_TOP + USABLE_CHART_HEIGHT/2})`}>GPU Units</text>

      {idleReservedArea && baseReservedCapacity > 0 && <path d={idleReservedArea} fill="#E0E0E0" opacity="0.5" aria-label="Idle Reserved Capacity"/>}
      {utilizedReservedArea && baseReservedCapacity > 0 && <path d={utilizedReservedArea} fill={isAssuredModel ? "rgba(15, 157, 88, 0.3)" : "rgba(219, 68, 55, 0.3)"} aria-label="Utilized Reserved Capacity"/>}
      {isAssuredModel && utilizedOnDemandArea && <path d={utilizedOnDemandArea} fill="rgba(244, 180, 0, 0.4)" aria-label="Utilized On-Demand Capacity"/>}
      {unmetDemandArea && <path d={unmetDemandArea} fill="rgba(234, 67, 53, 0.6)" aria-label="Unmet Demand"/>}

      {baseReservedCapacity > 0 && <line x1={CHART_PADDING_LEFT} y1={reservedLineY} x2={width-CHART_PADDING_RIGHT} y2={reservedLineY} stroke={isAssuredModel ? "#0F9D58" : "#DB4437"} strokeWidth="2" strokeDasharray="4,2" aria-label="Base Reserved Capacity Line"/>}
      {isAssuredModel && assuredCeilingCapacity > 0 && baseReservedCapacity > 0 && assuredCeilingCapacity > baseReservedCapacity && <line x1={CHART_PADDING_LEFT} y1={assuredLineY} x2={width-CHART_PADDING_RIGHT} y2={assuredLineY} stroke="#F4B400" strokeWidth="2" strokeDasharray="4,2" aria-label="Assured On-Demand Capacity Line"/>}
      <path d={demandPath} stroke="#4285F4" strokeWidth="2.5" fill="none" aria-label="GPU Demand Line"/>

    </svg>
  );
};


interface Metrics {
  committedReservedGpuHours: number;
  utilizedBaseReservedGpuHours: number;
  utilizedOnDemandGpuHours: number;
  totalUtilizedGpuHours: number;
  idleBaseReservedGpuHours: number;
  unmetDemandGpuHours: number;
}

function calculateMetrics(
  inputBaseReservationAmount: number, 
  isAssuredModel: boolean,
  demandProfile: number[]
): Metrics {
  const hoursInProfile = demandProfile.length;
  let committedReservedGpuHours = inputBaseReservationAmount * hoursInProfile;

  let utilizedBaseReservedGpuHours = 0;
  let utilizedOnDemandGpuHours = 0;
  let idleBaseReservedGpuHours = 0;
  let unmetDemandGpuHours = 0;

  const onDemandCeiling = isAssuredModel ? inputBaseReservationAmount * 1.25 : inputBaseReservationAmount;

  demandProfile.forEach(demand => {
    if (inputBaseReservationAmount <= 0) { 
        unmetDemandGpuHours += demand;
        return;
    }

    if (demand <= inputBaseReservationAmount) {
      utilizedBaseReservedGpuHours += demand;
      idleBaseReservedGpuHours += (inputBaseReservationAmount - demand);
    } else if (demand <= onDemandCeiling) {
      utilizedBaseReservedGpuHours += inputBaseReservationAmount; 
      if (isAssuredModel) {
        utilizedOnDemandGpuHours += (demand - inputBaseReservationAmount);
      } else {
        unmetDemandGpuHours += (demand - inputBaseReservationAmount);
      }
    } else {
      utilizedBaseReservedGpuHours += inputBaseReservationAmount; 
      if (isAssuredModel) {
        utilizedOnDemandGpuHours += (onDemandCeiling - inputBaseReservationAmount);
      }
      unmetDemandGpuHours += (demand - onDemandCeiling);
    }
  });

  const totalUtilizedGpuHours = utilizedBaseReservedGpuHours + utilizedOnDemandGpuHours;

  return {
    committedReservedGpuHours,
    utilizedBaseReservedGpuHours,
    utilizedOnDemandGpuHours,
    totalUtilizedGpuHours,
    idleBaseReservedGpuHours,
    unmetDemandGpuHours,
  };
}


const App: React.FC = () => {
  const [targetPeakDemand, setTargetPeakDemand] = useState<number>(25);
  const [selectedProfileKey, setSelectedProfileKey] = useState<string>(Object.keys(DEMAND_PROFILES)[0]);
  const [chartWidth, setChartWidth] = useState(500);

  const currentDemandData = useMemo(() => DEMAND_PROFILES[selectedProfileKey].data, [selectedProfileKey]);

  const traditionalBaseReservation = targetPeakDemand;
  const assuredBaseReservation = targetPeakDemand > 0 ? targetPeakDemand / 1.25 : 0;


  const traditionalMetrics = useMemo(
    () => calculateMetrics(traditionalBaseReservation, false, currentDemandData),
    [traditionalBaseReservation, currentDemandData]
  );
  const assuredMetrics = useMemo(
    () => calculateMetrics(assuredBaseReservation, true, currentDemandData),
    [assuredBaseReservation, currentDemandData]
  );

  React.useEffect(() => {
    const handleResize = () => {
      const container = document.querySelector('.model-section .chart-container');
      if (container) {
        setChartWidth(container.clientWidth);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const actualPeakDemandInCurve = Math.max(...currentDemandData); 

  return (
    <div className="app-container">
      <header className="app-header">Assured On-Demand for Inference Demo</header>
      
      <section className="controls-panel" aria-labelledby="controls-heading">
        <h2 id="controls-heading" className="visually-hidden">Simulation Controls</h2>
        <div className="control-group">
          <label htmlFor="demand-profile-select">Demand Profile Shape:</label>
          <select 
            id="demand-profile-select" 
            value={selectedProfileKey} 
            onChange={(e) => setSelectedProfileKey(e.target.value)}
            aria-label="Select demand profile shape"
          >
            {Object.keys(DEMAND_PROFILES).map(key => (
              <option key={key} value={key}>{DEMAND_PROFILES[key].name}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="target-peak-demand-slider">Target Peak GPU Demand to Cover:</label>
          <input
            type="range"
            id="target-peak-demand-slider"
            min="0"
            max={MAX_POSSIBLE_SLIDER_DEMAND}
            value={targetPeakDemand}
            onChange={(e) => setTargetPeakDemand(parseInt(e.target.value, 10))}
            aria-valuemin={0}
            aria-valuemax={MAX_POSSIBLE_SLIDER_DEMAND}
            aria-valuenow={targetPeakDemand}
            aria-label="Set target peak GPU demand to cover"
          />
          <span className="slider-value" aria-live="polite">{targetPeakDemand} GPUs</span>
        </div>
      </section>

      <div className="models-comparison">
        <section className="model-section" aria-labelledby="traditional-model-heading">
          <h2 id="traditional-model-heading">Traditional Reservation Model</h2>
          <div className="chart-container">
            {chartWidth > 0 && <SvgChart width={chartWidth} baseReservedCapacity={traditionalBaseReservation} isAssuredModel={false} demandData={currentDemandData} yAxisMax={MAX_POSSIBLE_SLIDER_DEMAND}/>}
          </div>
          <div className="metrics-display">
            <div className="metric-item metric-reserved"><strong>Reserved GPU Hours:</strong> <span className="value">{traditionalMetrics.committedReservedGpuHours.toFixed(0)}</span></div>
            <div className="metric-item metric-utilized"><strong>Utilized (Base) GPU Hours:</strong> <span className="value">{traditionalMetrics.utilizedBaseReservedGpuHours.toFixed(0)}</span></div>
            <div className="metric-item metric-idle"><strong>Idle Reserved GPU Hours:</strong> <span className="value">{traditionalMetrics.idleBaseReservedGpuHours.toFixed(0)}</span></div>
            <div className="metric-item metric-unmet"><strong>Unmet Demand GPU Hours:</strong> <span className="value">{traditionalMetrics.unmetDemandGpuHours.toFixed(0)}</span></div>
          </div>
           <div className="metrics-summary">
            To cover a chosen peak of {targetPeakDemand} GPUs, this model reserves all {targetPeakDemand} GPUs.
            <ul>
              <li>Total Reserved: {traditionalMetrics.committedReservedGpuHours.toFixed(0)} GPU hrs.</li>
              <li>Idle: {traditionalMetrics.idleBaseReservedGpuHours.toFixed(0)} GPU hrs.</li>
              <li>Unmet: {traditionalMetrics.unmetDemandGpuHours.toFixed(0)} GPU hrs.</li>
            </ul>
          </div>
        </section>

        <section className="model-section" aria-labelledby="assured-model-heading">
          <h2 id="assured-model-heading">Assured On-Demand Model</h2>
          <div className="chart-container">
             {chartWidth > 0 && <SvgChart width={chartWidth} baseReservedCapacity={assuredBaseReservation} isAssuredModel={true} demandData={currentDemandData} yAxisMax={MAX_POSSIBLE_SLIDER_DEMAND}/>}
          </div>
          <div className="metrics-display">
            <div className="metric-item metric-reserved"><strong>Base Reserved GPU Hours (r):</strong> <span className="value">{assuredMetrics.committedReservedGpuHours.toFixed(0)}</span></div>
            <div className="metric-item metric-on-demand"><strong>On-Demand GPU Hours Used (+25%):</strong> <span className="value">{assuredMetrics.utilizedOnDemandGpuHours.toFixed(0)}</span></div>
            <div className="metric-item metric-utilized"><strong>Total Utilized GPU Hours:</strong> <span className="value">{assuredMetrics.totalUtilizedGpuHours.toFixed(0)}</span></div>
            <div className="metric-item metric-idle"><strong>Idle Base Reserved GPU Hours:</strong> <span className="value">{assuredMetrics.idleBaseReservedGpuHours.toFixed(0)}</span></div>
            <div className="metric-item metric-unmet"><strong>Unmet Demand GPU Hours:</strong> <span className="value">{assuredMetrics.unmetDemandGpuHours.toFixed(0)}</span></div>
          </div>
          <div className="metrics-summary">
            To cover a chosen peak of {targetPeakDemand} GPUs:
            <ul>
              <li>Base reservation (r): <strong>{assuredBaseReservation.toFixed(1)} GPUs</strong>.</li>
              <li>Assured On-Demand (up to +25% of r): {(assuredBaseReservation * 0.25).toFixed(1)} GPUs.</li>
              <li>Total effective coverage: <strong>{targetPeakDemand > 0 ? (assuredBaseReservation * 1.25).toFixed(1) : "0.0"} GPUs</strong>.</li>
              <li>Idle Base: {assuredMetrics.idleBaseReservedGpuHours.toFixed(0)} GPU hrs.</li>
              <li>Unmet: {assuredMetrics.unmetDemandGpuHours.toFixed(0)} GPU hrs.</li>
            </ul>
          </div>
        </section>
      </div>
      <div className="legend">
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#4285F4'}}></span>Demand</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: 'rgba(219, 68, 55, 0.3)'}}></span>Traditional Utilized</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: 'rgba(15, 157, 88, 0.3)'}}></span>Assured Base Utilized</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: 'rgba(244, 180, 0, 0.4)'}}></span>Assured On-Demand Utilized</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: 'rgba(234, 67, 53, 0.6)'}}></span>Unmet Demand</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#E0E0E0'}}></span>Idle Reserved</div>
      </div>
      <p className="visually-hidden" id="svg-chart-description">
        The charts display GPU usage over 24 hours. The blue line represents actual GPU demand.
        In the Traditional model, a dashed red line shows the fixed reservation.
        In the Assured On-Demand model, a dashed green line shows the base reservation, and a dashed yellow line shows the additional 25% assured capacity ceiling.
        Colored areas indicate utilized capacity, idle capacity, and unmet demand.
      </p>
      <style>{`.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }`}</style>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
