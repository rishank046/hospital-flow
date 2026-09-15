// Main Simulation Application Dashboard
// Strictly isolated to apps/web/src/simulation/

import { useEffect, useState } from 'react';
import './styles/simulation.css';
import { simulationEngine } from './engine/simulationEngine';
import { PRESET_SCENARIOS, type ScenarioConfig } from './engine/scenarioConfig';
import type {
  DepartmentType,
  SimulationDisplayMode,
  SimulationState,
} from './engine/simulationTypes';
import { SimulationHeader } from './components/SimulationHeader';
import { ScenarioControls } from './components/ScenarioControls';
import { AdminProvisioningModal } from './components/AdminProvisioningModal';
import { MetricsOverview } from './components/GuiMode/MetricsOverview';
import { HospitalMap } from './components/GuiMode/HospitalMap';
import { PatientJourneyTracker } from './components/GuiMode/PatientJourneyTracker';
import { Hospital2DMap } from './components/MapMode/Hospital2DMap';
import { RequestLogTable } from './components/LogMode/RequestLogTable';
import { EventLogStream } from './components/LogMode/EventLogStream';

export function SimulationApp() {
  const [state, setState] = useState<SimulationState>(() => simulationEngine.getState());
  const [displayMode, setDisplayMode] = useState<SimulationDisplayMode>('MAP');
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminCreds, setAdminCreds] = useState<{ email?: string; password?: string; token?: string } | null>(null);

  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  const currentScenario =
    PRESET_SCENARIOS.find((s) => s.id === state.currentScenarioId) || PRESET_SCENARIOS[0];

  const handleSelectScenario = (scenario: ScenarioConfig) => {
    simulationEngine.setScenario(scenario);
  };

  const handleStart = () => {
    simulationEngine.start();
  };

  const handlePause = () => {
    simulationEngine.pause();
  };

  const handleResume = () => {
    simulationEngine.resume();
  };

  const handleReset = () => {
    simulationEngine.reset();
    setSelectedPatientId(null);
    setSelectedDepartment(null);
  };

  const handleStep = () => {
    simulationEngine.stepForward();
  };

  const handleSpeedChange = (speed: number) => {
    simulationEngine.setSpeed(speed);
  };

  const handleSaveAdminCreds = (creds: { email?: string; password?: string; token?: string } | null) => {
    setAdminCreds(creds);
    simulationEngine.setAdminCredentials(creds);
  };

  return (
    <div className="mediq-simulation">
      <SimulationHeader
        state={state}
        displayMode={displayMode}
        onModeChange={setDisplayMode}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onReset={handleReset}
        onStep={handleStep}
        onSpeedChange={handleSpeedChange}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
      />

      <main className="sim-content">
        {/* Scenario Controls */}
        <ScenarioControls
          currentScenario={currentScenario}
          onSelectScenario={handleSelectScenario}
          isRunning={state.status === 'RUNNING' || state.status === 'BOOTSTRAPPING'}
        />

        {/* Global Key Metrics Overview */}
        <MetricsOverview metrics={state.metrics} />

        {/* 2D MAP MODE (Interactive Floor Plan & CS Array Queues) */}
        {displayMode === 'MAP' && (
          <div>
            <Hospital2DMap
              departments={state.departments}
              patients={state.patients}
              actors={state.actors}
              onSelectPatient={(patId) => setSelectedPatientId(patId)}
            />

            <PatientJourneyTracker
              patients={state.patients}
              selectedPatientId={selectedPatientId}
              onSelectPatient={setSelectedPatientId}
              departmentFilter={selectedDepartment}
            />
          </div>
        )}

        {/* GUI MODE */}
        {displayMode === 'GUI' && (
          <div>
            <HospitalMap
              departments={state.departments}
              patients={state.patients}
              selectedDepartment={selectedDepartment}
              onSelectDepartment={setSelectedDepartment}
              onSelectPatient={(patId) => setSelectedPatientId(patId)}
            />

            <PatientJourneyTracker
              patients={state.patients}
              selectedPatientId={selectedPatientId}
              onSelectPatient={setSelectedPatientId}
              departmentFilter={selectedDepartment}
            />
          </div>
        )}

        {/* LOG MODE */}
        {displayMode === 'LOG' && (
          <div>
            <RequestLogTable logs={state.requestLogs} />
            <EventLogStream events={state.recentEvents} />
          </div>
        )}
      </main>

      <AdminProvisioningModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSave={handleSaveAdminCreds}
        initialCreds={adminCreds}
      />
    </div>
  );
}

export default SimulationApp;
