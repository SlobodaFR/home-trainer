import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './presentation/auth/RequireAuth';
import { ExecutionPage } from './presentation/execution/ExecutionPage';
import { ExerciseDetailPage } from './presentation/exercises/ExerciseDetailPage';
import { ExercisesPage } from './presentation/exercises/ExercisesPage';
import { LoginPage } from './presentation/pages/LoginPage';
import { DashboardPage } from './presentation/planning/DashboardPage';
import { GoalFormPage } from './presentation/planning/GoalFormPage';
import { HistoryPage } from './presentation/planning/HistoryPage';
import { SessionDetailPage } from './presentation/planning/SessionDetailPage';
import { AnalysisBanner } from './presentation/shared/AnalysisBanner';
import { AnalysisProvider } from './presentation/shared/AnalysisContext';
import { NavBar } from './presentation/shared/NavBar';

export default function App() {
  return (
    <AnalysisProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/sessions/:id/execute"
          element={
            <RequireAuth>
              <ExecutionPage />
            </RequireAuth>
          }
        />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <>
                <AnalysisBanner />
                <NavBar />
                <Routes>
                  <Route index element={<DashboardPage />} />
                  <Route path="exercises" element={<ExercisesPage />} />
                  <Route
                    path="exercises/:id"
                    element={<ExerciseDetailPage />}
                  />
                  <Route path="goals/new" element={<GoalFormPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="sessions/:id" element={<SessionDetailPage />} />
                </Routes>
              </>
            </RequireAuth>
          }
        />
      </Routes>
    </AnalysisProvider>
  );
}
