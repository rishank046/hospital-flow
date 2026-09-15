// Scenario Configuration & Presets
// Strictly isolated to apps/web/src/simulation/engine/

/**
 * Scenario JSON contains WORKLOAD and TIMING configuration ONLY.
 * MUST NEVER contain credentials, emails, passwords, or tokens.
 */
export interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  workload: {
    numUsers: number;
    numDoctors: number;
    numStaff: {
      opdManagers: number;
      labTechs: number;
      pharmacists: number;
      billingClerks: number;
    };
    numWalkIns: number;
    numAppointments: number;
  };
  arrival: {
    pattern: 'uniform' | 'burst' | 'poisson';
    intervalSeconds: number;
  };
  probabilities: {
    orderLabTestProbability: number;     // 0.0 - 1.0
    prescriptionProbability: number;     // 0.0 - 1.0
    cashPaymentProbability: number;      // 0.0 - 1.0 (cash vs online checkout)
  };
  timing: {
    consultationDurationSec: number;
    labProcessingDurationSec: number;
    pharmacyDispenseDurationSec: number;
    billingProcessingDurationSec: number;
  };
  simulationSpeed: number; // 1, 2, 5, 10
  randomSeed: number;
}

export const PRESET_SCENARIOS: ScenarioConfig[] = [
  {
    id: 'balanced-day',
    name: 'Balanced Clinical Day',
    description: 'A standard hospital shift with evenly spaced appointments, walk-ins, consultations, and balanced lab/pharmacy flow.',
    workload: {
      numUsers: 3,
      numDoctors: 2,
      numStaff: {
        opdManagers: 1,
        labTechs: 1,
        pharmacists: 1,
        billingClerks: 1,
      },
      numWalkIns: 4,
      numAppointments: 3,
    },
    arrival: {
      pattern: 'uniform',
      intervalSeconds: 6,
    },
    probabilities: {
      orderLabTestProbability: 0.5,
      prescriptionProbability: 0.8,
      cashPaymentProbability: 0.6,
    },
    timing: {
      consultationDurationSec: 4,
      labProcessingDurationSec: 5,
      pharmacyDispenseDurationSec: 3,
      billingProcessingDurationSec: 3,
    },
    simulationSpeed: 2,
    randomSeed: 42,
  },
  {
    id: 'morning-opd-rush',
    name: 'Morning OPD Rush',
    description: 'High volume of walk-in patients arriving in bursts, testing intake throughput, dynamic queue order, and doctor consultation speed.',
    workload: {
      numUsers: 2,
      numDoctors: 2,
      numStaff: {
        opdManagers: 2,
        labTechs: 1,
        pharmacists: 1,
        billingClerks: 1,
      },
      numWalkIns: 8,
      numAppointments: 2,
    },
    arrival: {
      pattern: 'burst',
      intervalSeconds: 3,
    },
    probabilities: {
      orderLabTestProbability: 0.4,
      prescriptionProbability: 0.9,
      cashPaymentProbability: 0.8,
    },
    timing: {
      consultationDurationSec: 3,
      labProcessingDurationSec: 4,
      pharmacyDispenseDurationSec: 3,
      billingProcessingDurationSec: 2,
    },
    simulationSpeed: 2,
    randomSeed: 101,
  },
  {
    id: 'diagnostic-intensive',
    name: 'Diagnostic & Lab Intensive',
    description: 'High diagnostic order rate where downstream pharmacy and billing are blocked until sample collection and lab reports complete.',
    workload: {
      numUsers: 4,
      numDoctors: 2,
      numStaff: {
        opdManagers: 1,
        labTechs: 2,
        pharmacists: 1,
        billingClerks: 1,
      },
      numWalkIns: 3,
      numAppointments: 5,
    },
    arrival: {
      pattern: 'uniform',
      intervalSeconds: 5,
    },
    probabilities: {
      orderLabTestProbability: 0.9,
      prescriptionProbability: 0.7,
      cashPaymentProbability: 0.5,
    },
    timing: {
      consultationDurationSec: 4,
      labProcessingDurationSec: 8,
      pharmacyDispenseDurationSec: 3,
      billingProcessingDurationSec: 3,
    },
    simulationSpeed: 2,
    randomSeed: 202,
  },
  {
    id: 'pharmacy-billing-bottleneck',
    name: 'Pharmacy & Cash Counter Bottleneck',
    description: 'Heavy prescription output and 100% cash payments, demonstrating queue accumulation at dispensary and billing stations.',
    workload: {
      numUsers: 3,
      numDoctors: 2,
      numStaff: {
        opdManagers: 1,
        labTechs: 1,
        pharmacists: 1,
        billingClerks: 1,
      },
      numWalkIns: 5,
      numAppointments: 3,
    },
    arrival: {
      pattern: 'poisson',
      intervalSeconds: 4,
    },
    probabilities: {
      orderLabTestProbability: 0.3,
      prescriptionProbability: 1.0,
      cashPaymentProbability: 1.0,
    },
    timing: {
      consultationDurationSec: 3,
      labProcessingDurationSec: 3,
      pharmacyDispenseDurationSec: 7,
      billingProcessingDurationSec: 6,
    },
    simulationSpeed: 2,
    randomSeed: 303,
  },
];

/**
 * Validates that a scenario configuration does NOT leak any credentials.
 */
export function validateScenarioConfig(config: ScenarioConfig): void {
  const jsonStr = JSON.stringify(config).toLowerCase();
  if (
    jsonStr.includes('"password"') ||
    jsonStr.includes('"token"') ||
    jsonStr.includes('"secret"') ||
    jsonStr.includes('"email"') ||
    jsonStr.includes('"authorization"')
  ) {
    throw new Error('Security Violation: Scenario configuration must never contain credentials or emails.');
  }
}
