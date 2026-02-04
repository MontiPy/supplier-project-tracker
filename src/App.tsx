import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SuppliersList } from './pages/Suppliers/SuppliersList';
import { SupplierDetail } from './pages/Suppliers/SupplierDetail';
import { ActivityLibraryPage } from './pages/ActivityLibrary/ActivityLibraryPage';
import { HelpPage } from './pages/Help/HelpPage';
import { ProjectsList } from './pages/Projects/ProjectsList';
import ProjectDetailPage from './pages/Projects/ProjectDetail';
import { ProjectConfigureDates } from './pages/Projects/ProjectConfigureDates';
import { SupplierProjectDetailPage } from './pages/SupplierProjects/SupplierProjectDetail';
import { PartsList } from './pages/Parts/PartsList';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { ImportExportPage } from './pages/ImportExport/ImportExportPage';
import { ProjectTemplatesPage } from './pages/ProjectTemplates/ProjectTemplatesPage';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/suppliers" element={<SuppliersList />} />
        <Route path="/suppliers/:id" element={<SupplierDetail />} />
        <Route path="/supplier-projects/:id" element={<SupplierProjectDetailPage />} />
        <Route path="/projects/:projectId/configure-dates" element={<ProjectConfigureDates />} />
        <Route
          path="/projects/:projectId/activities/:activityId/configure-dates"
          element={<ProjectConfigureDates />}
        />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/activity-library" element={<ActivityLibraryPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/parts" element={<PartsList />} />
        <Route path="/project-templates" element={<ProjectTemplatesPage />} />
        <Route path="/import-export" element={<ImportExportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Layout>
    <Toaster />
    </>
  );
}

export default App;
