import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './presentation/auth/RequireAuth';
import { LoginPage } from './presentation/pages/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <h1 className="text-2xl font-semibold text-gray-900">
                Dashboard
              </h1>
            </div>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
