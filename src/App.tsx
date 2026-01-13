import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SuppliersList } from './pages/Suppliers/SuppliersList';
import { ActivityTemplatesList } from './pages/ActivityLibrary/ActivityTemplatesList';
import { ProjectsList } from './pages/Projects/ProjectsList';
import ProjectDetailPage from './pages/Projects/ProjectDetail';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/suppliers" element={<SuppliersList />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/activity-library" element={<ActivityTemplatesList />} />
        <Route path="/parts" element={<div className="p-8">Parts (Coming in Phase 3)</div>} />
      </Routes>
    </Layout>
  );
}

export default App;
