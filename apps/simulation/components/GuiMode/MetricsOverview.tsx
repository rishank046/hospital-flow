// Operational Metrics Overview & Bottleneck Alert
// Strictly isolated to apps/web/src/simulation/components/GuiMode/

import { AlertTriangle } from 'lucide-react';
import type { OverallSimulationMetrics } from '../../engine/simulationTypes';

interface MetricsOverviewProps {
  metrics: OverallSimulationMetrics;
}

export function MetricsOverview({ metrics }: MetricsOverviewProps) {
  const successRate =
    metrics.totalRequests > 0
      ? Math.round((metrics.successRequests / metrics.totalRequests) * 100)
      : 100;

  return (
    <div>
      {/* Bottleneck Alert Banner */}
      {metrics.bottleneckDepartment && (
        <div className="sim-bottleneck-banner">
          <div className="sim-bottleneck-title">
            <AlertTriangle size={20} />
            <span>Operational Bottleneck Detected: {metrics.bottleneckDepartment}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
            Queue backlog exceeds station processing capacity. Consider adjusting arrival intervals or staff allocation.
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="sim-metrics-grid">
        <div className="sim-metric-card">
          <span className="sim-metric-label">Total Patients</span>
          <strong className="sim-metric-val">{metrics.totalPatients}</strong>
          <span className="sim-metric-sub">Scheduled / Registered</span>
        </div>

        <div className="sim-metric-card">
          <span className="sim-metric-label">In Clinical Care</span>
          <strong className="sim-metric-val" style={{ color: '#38bdf8' }}>
            {metrics.inProgressVisits}
          </strong>
          <span className="sim-metric-sub">Active in Departments</span>
        </div>

        <div className="sim-metric-card">
          <span className="sim-metric-label">Completed & Discharged</span>
          <strong className="sim-metric-val" style={{ color: '#34d399' }}>
            {metrics.completedJourneys}
          </strong>
          <span className="sim-metric-sub">Finished full care journey</span>
        </div>

        <div className="sim-metric-card">
          <span className="sim-metric-label">Avg Journey Time</span>
          <strong className="sim-metric-val">
            {metrics.avgCycleTimeSec > 0 ? `${metrics.avgCycleTimeSec}s` : '—'}
          </strong>
          <span className="sim-metric-sub">Intake to discharge</span>
        </div>

        <div className="sim-metric-card">
          <span className="sim-metric-label">Simulated Actors</span>
          <strong className="sim-metric-val">{metrics.activeActorsCount}</strong>
          <span className="sim-metric-sub">Doctors, Staff & Users</span>
        </div>

        <div className="sim-metric-card">
          <span className="sim-metric-label">API Throughput</span>
          <strong className="sim-metric-val" style={{ color: successRate < 90 ? '#f87171' : '#34d399' }}>
            {metrics.totalRequests}
          </strong>
          <span className="sim-metric-sub">
            {successRate}% Success Rate ({metrics.errorRequests} err)
          </span>
        </div>
      </div>
    </div>
  );
}
