export {
  updateProfileFromTransaction,
  matchesProfilePlanScope,
  countProfileOccasions,
  calculateOccasionForecasts,
  orderForecastsByUsage,
  simulateSpend,
  simulateSpendMultiMetric,
  calculateScenarioCost,
} from './forecasting';
export type {
  ProfileLearningUpdate,
  OccasionForecast,
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
