// Simulation Module Public Exports
// Strictly isolated to apps/web/src/simulation/

export { SimulationApp, default as SimulationAppDefault } from './SimulationApp';
export { simulationEngine, SimulationEngine } from './engine/simulationEngine';
export { EventScheduler } from './engine/eventScheduler';
export {
  PRESET_SCENARIOS,
  validateScenarioConfig,
  type ScenarioConfig,
} from './engine/scenarioConfig';
export {
  generateRunId,
  generateDynamicEmail,
  generateDynamicPassword,
  generateActorName,
} from './engine/credentialGenerator';
export { simulationApi, SimulationApiService } from './api/simulation.api';
export { simulationHttp, type RequestActorContext } from './api/simulation.http';
export * from './api/simulation.api.types';
export * from './engine/simulationTypes';
