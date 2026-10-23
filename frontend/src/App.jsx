import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Repository from "./pages/Repository.jsx";
import ExperimentForm from "./pages/ExperimentForm.jsx";
import ExperimentDetail from "./pages/ExperimentDetail.jsx";
import HypothesisLab from "./pages/HypothesisLab.jsx";
import Compare from "./pages/Compare.jsx";
import Evaluation from "./pages/Evaluation.jsx";
import KnowledgeGraph from "./pages/KnowledgeGraph.jsx";
import AICheck from "./pages/AICheck.jsx";
import AuditLogPage from "./pages/AuditLogPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/repository" element={<Repository />} />
        <Route path="/experiments/new" element={<ExperimentForm />} />
        <Route path="/experiments/:id" element={<ExperimentDetail />} />
        <Route path="/hypotheses" element={<HypothesisLab />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/eval" element={<Evaluation />} />
        <Route path="/graph" element={<KnowledgeGraph />} />
        <Route path="/ai-check" element={<AICheck />} />
        <Route path="/audit" element={<AuditLogPage />} />
      </Route>
    </Routes>
  );
}
