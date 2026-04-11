import { useRef, useEffect, memo } from 'react';
import * as echarts from 'echarts';

let mapRegistered = false;

// Scattered island-cluster patches for Hoàng Sa (Paracel) + Trường Sa (Spratly).
// Each patch is 1.4°×1.1° — visible at world-map zoom (~2px each) while
// multiple separate patches scattered across the sea look like distinct island groups.
function makeRect(cx: number, cy: number, w = 1.4, h = 1.1): number[][] {
  const hw = w / 2, hh = h / 2;
  return [
    [cx - hw, cy + hh], [cx + hw, cy + hh],
    [cx + hw, cy - hh], [cx - hw, cy - hh],
    [cx - hw, cy + hh],
  ];
}

// Hoàng Sa (Paracel Islands): 2 distinct cluster patches
const HOANG_SA_PATCHES = [
  makeRect(111.80, 16.50),   // Crescent Group   ~111.7 E, 16.5 N
  makeRect(112.50, 17.05),   // Amphitrite Group ~112.5 E, 17.0 N
];

// Trường Sa (Spratly Islands): 3 cluster patches spread N→S
const TRUONG_SA_PATCHES = [
  makeRect(114.20, 11.45),   // Northern cluster ~114 E, 11.5 N
  makeRect(114.00,  9.90),   // Central cluster  ~114 E,  9.9 N
  makeRect(112.95,  8.60),   // Southern cluster ~113 E,  8.6 N
];

async function ensureWorldMap(): Promise<void> {
  if (mapRegistered) return;
  const resp = await fetch('/echarts/world.json');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const geo = await resp.json() as {
    type: string;
    features: Array<{ id?: string; properties?: { name?: string }; geometry: any }>;
  };

  // Patch Vietnam's feature to include island territories
  const vnFeature = geo.features.find(
    f => f.properties?.name === 'Vietnam' || f.id === 'VNM'
  );
  if (vnFeature) {
    const allPatches = [...HOANG_SA_PATCHES, ...TRUONG_SA_PATCHES].map(ring => [ring]);
    const g = vnFeature.geometry;
    if (g.type === 'Polygon') {
      vnFeature.geometry = {
        type: 'MultiPolygon',
        coordinates: [g.coordinates, ...allPatches],
      };
    } else if (g.type === 'MultiPolygon') {
      g.coordinates.push(...allPatches);
    }
  }

  echarts.registerMap('world', geo as any);
  mapRegistered = true;
}

export interface MapDataPoint {
  name: string;
  value: number;
}


function buildOption(mode: 'requests' | 'blocked', data: MapDataPoint[]) {
  const isBlocked = mode === 'blocked';
  const vals  = data.map(d => d.value);
  const maxVal = Math.max(...vals, 1);

  const colorRange = isBlocked
    ? ['#fee2e2', '#fca5a5', '#f87171', '#ef4444', '#b91c1c']
    : ['#e0f7fa', '#80deea', '#26c6da', '#00acc1', '#00697a'];

  const accentColor = isBlocked ? '#ef4444' : '#00bcd4';
  const label = isBlocked ? 'Blocked' : 'Requests';

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#1e293b', fontSize: 12 },
      formatter: (params: any) => {
        if (params.componentType === 'geo') return '';
        const raw = params.value;
        const val = (raw == null || raw === '-' || isNaN(Number(raw))) ? 0 : Number(raw);
        const isVN = params.name === 'Vietnam';
        const islands = isVN
          ? `<div style="color:#64748b;font-size:11px;margin-top:5px;padding-top:5px;border-top:1px solid #e2e8f0">🇻🇳 Hoàng Sa &nbsp;·&nbsp; 🇻🇳 Trường Sa</div>`
          : '';
        return `<div style="font-weight:600;margin-bottom:2px">${params.name}</div>
                <div style="color:#64748b">${label}: <b style="color:${accentColor}">${Number(val).toLocaleString()}</b></div>
                ${islands}`;
      },
    },
    visualMap: {
      type: 'continuous',
      min: 0,
      max: maxVal,
      show: false,
      inRange: { color: data.length > 0 ? colorRange : ['#f8fafc', '#f8fafc'] },
    },
    geo: {
      map: 'world',
      roam: false,
      zoom: 1.22,
      center: [20, 10],
      itemStyle: {
        areaColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 0.5,
      },
      emphasis: {
        itemStyle: { areaColor: '#e2e8f0', borderColor: '#cbd5e1' },
        label: { show: false },
      },
      select: { disabled: true },
    },
    series: [
      {
        type: 'map',
        map: 'world',
        geoIndex: 0,
        roam: false,
        data,
        select: { disabled: true },
      } as any,
    ],
  };
}

interface EChartsMapProps {
  height?: number;
  mode?: 'requests' | 'blocked';
  data?: MapDataPoint[];
}

export const EChartsMap = memo(function EChartsMap({
  height = 300,
  mode = 'requests',
  data = [],
}: EChartsMapProps) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const readyRef = useRef(false);
  const modeRef  = useRef(mode);
  const dataRef  = useRef(data);

  modeRef.current = mode;
  dataRef.current = data;

  useEffect(() => {
    if (!wrapRef.current) return;

    ensureWorldMap()
      .then(() => {
        if (!wrapRef.current) return;
        const chart = echarts.init(wrapRef.current, undefined, { renderer: 'canvas' });
        chartRef.current = chart;
        readyRef.current = true;

        chart.setOption(buildOption(modeRef.current, dataRef.current));

        chart.on('mouseover', (params: any) => {
          if (params.componentType !== 'series' || params.name !== 'Vietnam') return;
          chart.dispatchAction({ type: 'highlight', seriesIndex: 1 });
        });
        chart.on('mouseout', (params: any) => {
          if (params.componentType !== 'series' || params.name !== 'Vietnam') return;
          chart.dispatchAction({ type: 'downplay', seriesIndex: 1 });
        });

        const ro = new ResizeObserver(() => chart.resize());
        ro.observe(wrapRef.current!);
        (chart as any)._ro = ro;
      })
      .catch(err => {
        console.error('[EChartsMap] failed to load world map:', err);
        if (wrapRef.current)
          wrapRef.current.innerHTML =
            '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#94a3b8;font-size:12px">Map unavailable</div>';
      });

    return () => {
      if (chartRef.current) {
        (chartRef.current as any)._ro?.disconnect();
        chartRef.current.dispose();
        chartRef.current = null;
        readyRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current || !chartRef.current) return;
    chartRef.current.setOption(buildOption(mode, dataRef.current), true);
  }, [mode]);

  useEffect(() => {
    if (!readyRef.current || !chartRef.current) return;
    chartRef.current.setOption(buildOption(modeRef.current, data), true);
  }, [data]);

  return (
    <div
      ref={wrapRef}
      style={{ width: '100%', height, background: 'transparent' }}
    />
  );
});
