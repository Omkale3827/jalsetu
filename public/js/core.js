/**
 * JALSETU - Water Demand Management System
 * Core State & Business Logic
 * Adheres strictly to PRD.md, TECH_SPEC.md, and DESIGN_SYSTEM.md
 */

// Global App State
const JalsetuState = {
  activeView: 'home',
  selectedCity: 'Thane',
  selectedZone: 'all',
  selectedHorizon: '24h',
  totalAvailableSupply: 1620000, // Default scenario supply from mockup
  userSupplyInput: 1620000,
  zones: [],
  chartInstances: {},
  riskThresholds: {
    high: 0.20, // Shortage >= 20% is High risk
    medium: 0.05 // Shortage >= 5% is Medium risk
  },
  // User Profile & Authentication State
  currentUser: {
    id: "OP-4082",
    name: "Santoshi Sharma",
    email: "santoshi.s@smartcity.gov.in",
    role: "Chief Operations Officer",
    department: "Municipal Water Distribution Board",
    jurisdiction: "Thane Urban Metropolitan Area",
    avatarInitials: "SS",
    accessLevel: "Tier 1 - Full Operational Control",
    lastLogin: "2026-10-11 10:45 AM IST"
  },
  roles: {
    operator: {
      id: "OP-4082",
      name: "Santoshi Sharma",
      email: "santoshi.s@smartcity.gov.in",
      role: "Chief Operations Officer",
      department: "Municipal Water Distribution Board",
      jurisdiction: "Thane Urban Metropolitan Area",
      avatarInitials: "SS",
      accessLevel: "Tier 1 - Full Operational Control"
    },
    analyst: {
      id: "PL-1094",
      name: "Aarav Patel",
      email: "aarav.patel@smartcity.gov.in",
      role: "Urban Water Systems Analyst",
      department: "Smart City Infrastructure Planning",
      jurisdiction: "All Districts (Cross-Zone)",
      avatarInitials: "AP",
      accessLevel: "Tier 2 - Analytics & What-If Simulation"
    }
  }
};

// Pure Business Logic Functions (Unit-Testable & Pure)
const JalsetuLogic = {
  /**
   * Shortage calculation: max(0, predicted_demand - available_supply)
   */
  calculateShortage(demand, supply) {
    return Math.max(0, demand - supply);
  },

  /**
   * Shortage percentage
   */
  calculateShortagePct(demand, shortage) {
    if (!demand || demand <= 0) return 0;
    return shortage / demand;
  },

  /**
   * Shortage risk classification
   * High: shortage_pct >= 20%
   * Medium: shortage_pct >= 5%
   * Low: otherwise (or 0 shortage)
   */
  classifyRisk(demand, supply, thresholds = JalsetuState.riskThresholds) {
    const shortage = this.calculateShortage(demand, supply);
    if (shortage <= 0) return 'Low';
    const pct = shortage / demand;
    if (pct >= thresholds.high) return 'High';
    if (pct >= thresholds.medium) return 'Medium';
    return 'Low';
  },

  /**
   * Weighted Water-Filling Supply Redistribution
   * PRD-008 & TECH_SPEC 5.4
   * Invariants:
   * 1. Sum(allocation) <= Total Supply
   * 2. 0 <= allocation_i <= demand_i
   * 3. Higher-risk zones prioritized
   */
  redistributeSupply(zones, totalAvailableSupply) {
    const totalDemand = zones.reduce((sum, z) => sum + z.predictedDemand, 0);

    // Case 1: Supply satisfies or exceeds total demand
    if (totalAvailableSupply >= totalDemand) {
      return zones.map(z => ({
        ...z,
        recommendedAllocation: z.predictedDemand,
        netTransfer: z.predictedDemand - z.availableSupply,
        remainingShortage: 0,
        risk: 'Low'
      }));
    }

    // Case 2: Water deficit - allocate by demand weighted with shortage risk
    // Risk weight mapping: High: +50%, Medium: +20%, Low: +0%
    const riskFactorMap = { 'High': 0.50, 'Medium': 0.20, 'Low': 0.0 };

    // Calculate initial weights
    const unallocated = zones.map(z => {
      const shortage = this.calculateShortage(z.predictedDemand, z.availableSupply);
      const risk = this.classifyRisk(z.predictedDemand, z.availableSupply);
      const weight = z.predictedDemand * (1 + (riskFactorMap[risk] || 0));
      return {
        ...z,
        risk,
        weight,
        allocated: 0,
        isCapped: false
      };
    });

    let remainingSupply = totalAvailableSupply;
    let iterations = 0;

    // Iterative progressive filling capping at demand_i
    while (remainingSupply > 1 && iterations < 10) {
      iterations++;
      const activeZones = unallocated.filter(z => !z.isCapped);
      if (activeZones.length === 0) break;

      const currentTotalWeight = activeZones.reduce((sum, z) => sum + z.weight, 0);
      if (currentTotalWeight <= 0) break;

      let newlyCapped = false;
      let supplyToDistribute = remainingSupply;

      for (const z of activeZones) {
        const share = (z.weight / currentTotalWeight) * supplyToDistribute;
        const potentialTotal = z.allocated + share;

        if (potentialTotal >= z.predictedDemand) {
          remainingSupply -= (z.predictedDemand - z.allocated);
          z.allocated = z.predictedDemand;
          z.isCapped = true;
          newlyCapped = true;
        } else {
          z.allocated = potentialTotal;
          remainingSupply -= share;
        }
      }

      if (!newlyCapped) break; // All remaining got distributed smoothly
    }

    // Round nicely to integers and compute net transfer
    return unallocated.map(z => {
      const rec = Math.round(z.allocated);
      const remainingShortage = Math.max(0, z.predictedDemand - rec);
      const netTransfer = rec - z.availableSupply;
      return {
        ...z,
        recommendedAllocation: rec,
        netTransfer: netTransfer,
        remainingShortage: remainingShortage,
        riskAfter: this.classifyRisk(z.predictedDemand, rec)
      };
    });
  },

  /**
   * Format numbers to localized strings (e.g. 1,850,000)
   */
  formatNumber(val) {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Math.round(val).toLocaleString('en-IN');
  }
};

// Expose on window for accessibility
window.JalsetuState = JalsetuState;
window.JalsetuLogic = JalsetuLogic;
