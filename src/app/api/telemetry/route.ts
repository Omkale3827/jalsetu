import { NextResponse } from 'next/server';
import { INITIAL_ZONES, Zone } from '@/lib/data';
import { JalsetuMath } from '@/lib/math';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const horizon = searchParams.get('horizon') || '24h';
  const totalSupplyParam = searchParams.get('supply');
  const supply = totalSupplyParam ? parseInt(totalSupplyParam, 10) : 1620000;

  // 1. Attempt to fetch from genuine Python Flask ML Backend (port 5000)
  try {
    const flaskRes = await fetch(`http://127.0.0.1:5000/api/telemetry?horizon=${horizon}&supply=${supply}`, {
      cache: 'no-store'
    });
    if (flaskRes.ok) {
      const flaskData = await flaskRes.json();
      if (flaskData && flaskData.series) {
        // Map Flask ML data to frontend contract
        const zonesFromFlask: Zone[] = (flaskData.zones || INITIAL_ZONES).map((z: any) => ({
          id: z.id,
          name: z.name,
          displayName: z.displayName,
          coordinates: z.coordinates,
          currentConsumption: z.currentConsumption,
          normalRange: z.normalRange,
          predictedDemand: z.predictedDemand,
          availableSupply: z.availableSupply,
          capacity: z.capacity,
          trend: z.trend,
          anomaly: z.anomaly
        }));

        const redistribution = JalsetuMath.redistributeSupply(zonesFromFlask, supply);

        return NextResponse.json({
          status: 'success',
          source: 'FLASK_ML_BACKEND_HIST_GRADIENT_BOOSTING',
          timestamp: new Date().toISOString(),
          zones: zonesFromFlask,
          series: flaskData.series,
          redistribution,
          transferRoutes: [
            {
              id: 'route-a-b',
              fromZoneId: 'zone-a',
              fromName: 'Zone A (North District)',
              fromCoords: [19.2183, 72.9781] as [number, number],
              toZoneId: 'zone-b',
              toName: 'Zone B (Central Commercial)',
              toCoords: [19.1995, 72.9644] as [number, number],
              transferVolume: 100000,
              status: 'Proposed via Primary Main Pipeline'
            },
            {
              id: 'route-a-c',
              fromZoneId: 'zone-a',
              fromName: 'Zone A (North District)',
              fromCoords: [19.2183, 72.9781] as [number, number],
              toZoneId: 'zone-c',
              toName: 'Zone C (West Suburbs)',
              toCoords: [19.1852, 72.9512] as [number, number],
              transferVolume: 50000,
              status: 'Proposed via Secondary Feeder Pipeline'
            }
          ],
          summary: {
            totalDemand: zonesFromFlask.reduce((s, z) => s + z.predictedDemand, 0),
            totalSupply: supply,
            totalShortage: zonesFromFlask.reduce((s, z) => s + JalsetuMath.calculateShortage(z.predictedDemand, z.availableSupply), 0)
          },
          disclaimer: 'Simulated prototype ML results. Not real Thane sensor telemetry.'
        });
      }
    }
  } catch (err) {
    // Graceful fallback to embedded profiles if Flask server is not yet running
  }

  // 2. Fallback: Hourly series (12 historical hours + horizon forecasted hours)
  const historicalHours = ['12 AM', '2 AM', '4 AM', '6 AM', '8 AM', '10 AM', '12 PM'];
  const forecastHours = ['2 PM', '4 PM', '6 PM', '8 PM', '10 PM', '12 AM'];
  const labels = [...historicalHours, ...forecastHours];
  const forecastStartIndex = historicalHours.length - 1;

  const zoneProfiles: Record<string, { historical: number[]; forecast: number[] }> = {
    'zone-a': {
      historical: [380, 410, 460, 520, 580, 510, 490],
      forecast: [530, 580, 620, 590, 540, 480]
    },
    'zone-b': {
      historical: [450, 490, 580, 720, 850, 820, 780],
      forecast: [880, 960, 1040, 980, 850, 710]
    },
    'zone-c': {
      historical: [320, 340, 390, 450, 520, 480, 430],
      forecast: [470, 510, 540, 510, 460, 410]
    },
    'zone-d': {
      historical: [480, 510, 620, 750, 810, 760, 710],
      forecast: [790, 840, 890, 850, 770, 680]
    },
    'zone-e': {
      historical: [350, 380, 440, 520, 610, 570, 530],
      forecast: [560, 610, 640, 600, 530, 460]
    }
  };

  const redistribution = JalsetuMath.redistributeSupply(INITIAL_ZONES, supply);

  const transferRoutes = [
    {
      id: 'route-a-b',
      fromZoneId: 'zone-a',
      fromName: 'Zone A (North District)',
      fromCoords: [19.2183, 72.9781] as [number, number],
      toZoneId: 'zone-b',
      toName: 'Zone B (Central Commercial)',
      toCoords: [19.1995, 72.9644] as [number, number],
      transferVolume: 100000,
      status: 'Proposed via Primary Main Pipeline'
    },
    {
      id: 'route-a-c',
      fromZoneId: 'zone-a',
      fromName: 'Zone A (North District)',
      fromCoords: [19.2183, 72.9781] as [number, number],
      toZoneId: 'zone-c',
      toName: 'Zone C (West Suburbs)',
      toCoords: [19.1852, 72.9512] as [number, number],
      transferVolume: 50000,
      status: 'Proposed via Secondary Feeder Pipeline'
    }
  ];

  return NextResponse.json({
    status: 'success',
    source: 'EMBEDDED_FALLBACK',
    timestamp: new Date().toISOString(),
    zones: INITIAL_ZONES,
    series: {
      labels,
      forecastStartIndex,
      profiles: zoneProfiles
    },
    redistribution,
    transferRoutes,
    summary: {
      totalDemand: INITIAL_ZONES.reduce((s, z) => s + z.predictedDemand, 0),
      totalSupply: supply,
      totalShortage: INITIAL_ZONES.reduce((s, z) => s + JalsetuMath.calculateShortage(z.predictedDemand, z.availableSupply), 0)
    },
    disclaimer: 'Simulated prototype results. Not real Thane telemetry.'
  });
}
