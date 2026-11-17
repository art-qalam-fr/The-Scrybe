import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Widget from './Widget.jsx';
import MigrationHarness from './reactflow-migration/MigrationHarness.jsx';
import Shell from './reactflow-migration/Shell.jsx';
import DashboardMigration from './reactflow-migration/DashboardMigration.jsx';
import WidgetMigration from './reactflow-migration/WidgetMigration.jsx';
import PipelineView from './reactflow-migration/PipelineView.jsx';
import './index.css';

// Détection de la fenêtre à afficher et du mode migration.
// L'UI historique (App.jsx / Widget.jsx) reste le défaut : la migration
// React Flow est opt-in via ?migration=harness|dashboard|flow|shell|widget
// tant que la parité visuelle n'est pas validée.
const params = new URLSearchParams(window.location.search);
const isWidget = params.get('window') === 'widget' || params.get('grid') === '1';
const migrationMode = params.get('migration');
const shell = migrationMode === 'shell';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {migrationMode === 'harness' ? (
        <MigrationHarness />
      ) : migrationMode === 'dashboard' ? (
        <DashboardMigration />
      ) : migrationMode === 'flow' ? (
        <PipelineView />
      ) : isWidget ? (
        migrationMode === 'widget' ? <WidgetMigration /> : <Widget />
      ) : (
        shell ? <Shell /> : <App />
      )}
  </React.StrictMode>
);
