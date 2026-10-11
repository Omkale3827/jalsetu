import { Zone } from './data';

export const JalsetuMath = {
  calculateShortage(demand: number, supply: number): number {
    return Math.max(0, demand - supply);
  },

  classifyRisk(demand: number, supply: number, tHigh = 0.20, tMed = 0.05): 'High' | 'Medium' | 'Low' {
    const shortage = this.calculateShortage(demand, supply);
    if (shortage <= 0 || demand <= 0) return 'Low';
    const pct = shortage / demand;
    if (pct >= tHigh) return 'High';
    if (pct >= tMed) return 'Medium';
    return 'Low';
  },

  redistributeSupply(zones: Zone[], totalAvailableSupply: number) {
    const totalDemand = zones.reduce((sum, z) => sum + z.predictedDemand, 0);

    if (totalAvailableSupply >= totalDemand) {
      return zones.map(z => ({
        ...z,
        recommendedAllocation: z.predictedDemand,
        netTransfer: z.predictedDemand - z.availableSupply,
        remainingShortage: 0,
        riskAfter: 'Low' as const
      }));
    }

    const riskFactorMap = { 'High': 0.50, 'Medium': 0.20, 'Low': 0.0 };
    const working = zones.map(z => {
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
    for (let iter = 0; iter < 10; iter++) {
      if (remainingSupply <= 1) break;
      const active = working.filter(z => !z.isCapped);
      if (active.length === 0) break;

      const currentTotalWeight = active.reduce((sum, z) => sum + z.weight, 0);
      if (currentTotalWeight <= 0) break;

      let newlyCapped = false;
      const supplyToDistribute = remainingSupply;

      for (const z of active) {
        const share = (z.weight / currentTotalWeight) * supplyToDistribute;
        const potential = z.allocated + share;

        if (potential >= z.predictedDemand) {
          remainingSupply -= (z.predictedDemand - z.allocated);
          z.allocated = z.predictedDemand;
          z.isCapped = true;
          newlyCapped = true;
        } else {
          z.allocated = potential;
          remainingSupply -= share;
        }
      }

      if (!newlyCapped) break;
    }

    return working.map(z => {
      const rec = Math.round(z.allocated);
      const remainingShortage = Math.max(0, z.predictedDemand - rec);
      const netTransfer = rec - z.availableSupply;
      return {
        ...z,
        recommendedAllocation: rec,
        netTransfer,
        remainingShortage,
        riskAfter: this.classifyRisk(z.predictedDemand, rec)
      };
    });
  },

  formatNumber(val: number): string {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Math.round(val).toLocaleString('en-IN');
  }
};
