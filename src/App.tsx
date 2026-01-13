import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SuppliersList } from './pages/Suppliers/SuppliersList';
import { SupplierDetail } from './pages/Suppliers/SupplierDetail';
import { ActivityTemplatesList } from './pages/ActivityLibrary/ActivityTemplatesList';
import { ActivityTemplateDetailPage } from './pages/ActivityLibrary/ActivityTemplateDetail';
import { HelpPage } from './pages/Help/HelpPage';
import { ProjectsList } from './pages/Projects/ProjectsList';
import ProjectDetailPage from './pages/Projects/ProjectDetail';
import { SupplierProjectDetailPage } from './pages/SupplierProjects/SupplierProjectDetail';
import { PartsList } from './pages/Parts/PartsList';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/suppliers" element={<SuppliersList />} />
        <Route path="/suppliers/:id" element={<SupplierDetail />} />
        <Route path="/supplier-projects/:id" element={<SupplierProjectDetailPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/activity-library" element={<ActivityTemplatesList />} />
        <Route path="/activity-library/:id" element={<ActivityTemplateDetailPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/parts" element={<PartsList />} />
      </Routes>
    </Layout>
  );
}

export default App;
