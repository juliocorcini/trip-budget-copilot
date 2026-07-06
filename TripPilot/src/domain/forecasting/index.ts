export {
  updateProfileFromTransaction,
  matchesProfilePlanScope,
  countProfileOccasions,
  calculateOccasionForecasts,
  calculatePlanProgress,
  orderForecastsByUsage,
  simulateSpend,
  simulateSpendMultiMetric,
  calculateScenarioCost,
} from './forecasting';
export type {
  ProfileLearningUpdate,
  OccasionForecast,
  PlanAllocationInput,
  PlanProgressLine,
  PlanProgress,
  SimulatorResult,
  SimulatorRisk,
  SimulatorVerdict,
  PlanImpact,
  MultiMetricSimulation,
  SimulateMultiMetricInput,
} from './forecasting';
export { simulateContextualSpend } from './contextual-simulation';
export type {
  SimulationTarget,
  SimulationProfileContext,
  SimulationEventContext,
  SimulationReserveContext,
  ContextualSimulationInput,
  ContextualSimulation,
  ContextualVerdict,
  ContextualVerdictTone,
  SimulationFact,
} from './contextual-simulation';
