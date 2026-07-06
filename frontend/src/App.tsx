import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './presentation/auth/RequireAuth';
import { ExerciseDetailPage } from './presentation/exercises/ExerciseDetailPage';
import { ExercisesPage } from './presentation/exercises/ExercisesPage';
import { LoginPage } from './presentation/pages/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Routes>
              <Route index element={<Navigate to="/exercises" replace />} />
              <Route path="exercises" element={<ExercisesPage />} />
              <Route path="exercises/:id" element={<ExerciseDetailPage />} />
            </Routes>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
