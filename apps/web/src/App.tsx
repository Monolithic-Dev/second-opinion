import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppStateProvider } from './hooks/useAppState';
import { AuthProvider } from './hooks/useAuth';
import { Demo } from './routes/Demo';

export function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/demo" replace />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="*" element={<Navigate to="/demo" replace />} />
          </Routes>
        </Layout>
      </AppStateProvider>
    </AuthProvider>
  );
}
