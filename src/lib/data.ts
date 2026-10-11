export interface Zone {
  id: string;
  name: string;
  displayName: string;
  coordinates: [number, number];
  currentConsumption: number;
  normalRange: [number, number];
  predictedDemand: number;
  availableSupply: number;
  capacity?: number;
  trend: 'Increase' | 'Decrease' | 'Stable';
  anomaly: {
    detected: boolean;
    severity: 'Normal' | 'High Alert' | 'High';
    type: string;
    deviationPct: number;
    timestamp?: string;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  jurisdiction: string;
  avatarInitials: string;
  accessLevel: string;
  lastLogin?: string;
}

export const INITIAL_ZONES: Zone[] = [
  {
    id: "zone-a",
    name: "Zone A",
    displayName: "Zone A (North District)",
    coordinates: [19.2183, 72.9781],
    currentConsumption: 510,
    normalRange: [450, 550],
    predictedDemand: 520000,
    availableSupply: 600000,
    capacity: 700000,
    trend: "Increase",
    anomaly: { detected: false, severity: "Normal", type: "None", deviationPct: 2.0, timestamp: "2026-10-11 09:00" }
  },
  {
    id: "zone-b",
    name: "Zone B",
    displayName: "Zone B (Central Commercial)",
    coordinates: [19.1995, 72.9644],
    currentConsumption: 850,
    normalRange: [400, 600],
    predictedDemand: 760000,
    availableSupply: 500000,
    capacity: 850000,
    trend: "Increase",
    anomaly: { detected: true, severity: "High Alert", type: "Sudden Demand Surge", deviationPct: 42.0, timestamp: "2026-10-11 08:30" }
  },
  {
    id: "zone-c",
    name: "Zone C",
    displayName: "Zone C (West Suburbs)",
    coordinates: [19.1852, 72.9512],
    currentConsumption: 590,
    normalRange: [500, 650],
    predictedDemand: 430000,
    availableSupply: 300000,
    capacity: 550000,
    trend: "Stable",
    anomaly: { detected: false, severity: "Normal", type: "None", deviationPct: -1.2, timestamp: "2026-10-11 09:00" }
  },
  {
    id: "zone-d",
    name: "Zone D",
    displayName: "Zone D (Industrial Belt)",
    coordinates: [19.2050, 72.9902],
    currentConsumption: 720,
    normalRange: [600, 700],
    predictedDemand: 690000,
    availableSupply: 550000,
    capacity: 750000,
    trend: "Increase",
    anomaly: { detected: true, severity: "High", type: "Sustained Elevation", deviationPct: 18.5, timestamp: "2026-10-11 07:45" }
  },
  {
    id: "zone-e",
    name: "Zone E",
    displayName: "Zone E (South Residential)",
    coordinates: [19.1724, 72.9730],
    currentConsumption: 480,
    normalRange: [450, 600],
    predictedDemand: 580000,
    availableSupply: 400000,
    capacity: 650000,
    trend: "Decrease",
    anomaly: { detected: false, severity: "Normal", type: "None", deviationPct: -3.5, timestamp: "2026-10-11 09:00" }
  }
];

export const INITIAL_USER: UserProfile = {
  id: "OP-4082",
  name: "Santoshi Sharma",
  email: "santoshi.s@smartcity.gov.in",
  role: "Chief Operations Officer",
  department: "Municipal Water Distribution Board",
  jurisdiction: "Thane Urban Metropolitan Area",
  avatarInitials: "SS",
  accessLevel: "Tier 1 - Full Operational Control",
  lastLogin: "2026-10-11 10:45 AM IST"
};

export const ROLE_PRESETS = {
  operator: INITIAL_USER,
  analyst: {
    id: "PL-1094",
    name: "Aarav Patel",
    email: "aarav.patel@smartcity.gov.in",
    role: "Urban Water Systems Analyst",
    department: "Smart City Infrastructure Planning",
    jurisdiction: "All Districts (Cross-Zone)",
    avatarInitials: "AP",
    accessLevel: "Tier 2 - Analytics & What-If Simulation",
    lastLogin: "2026-10-11 09:30 AM IST"
  }
};
