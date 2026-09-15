// Standalone Entrypoint for Direct Browser Access
// Strictly isolated to apps/web/src/simulation/

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SimulationApp } from './SimulationApp';

const container = document.getElementById('simulation-root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <SimulationApp />
    </StrictMode>
  );
}
