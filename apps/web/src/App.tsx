import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppStateProvider } from './hooks/useAppState';
import { AuthProvider } from './hooks/useAuth';
import { Demo } from './routes/Demo';
import { Circle } from './routes/console/Circle';
import { Console } from './routes/console/Console';
import { Dashboard } from './routes/console/Dashboard';
import { HoldDetailPage } from './routes/console/HoldDetailPage';
import { Holds } from './routes/console/Holds';
import { Inbox } from './routes/console/Inbox';
import { InsightsPage } from './routes/console/Insights';
import { PolicyPage } from './routes/console/PolicyPage';

export function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/demo" replace />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/family" element={<Console />}>
              <Route index element={<Dashboard />} />
              <Route path="holds" element={<Holds />} />
              <Route path="holds/:holdId" element={<HoldDetailPage />} />
              <Route path="circle" element={<Circle />} />
              <Route path="policy" element={<PolicyPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="inbox" element={<Inbox />} />
            </Route>
            <Route path="*" element={<Navigate to="/demo" replace />} />
          </Routes>
        </Layout>
      </AppStateProvider>
    </AuthProvider>
  );
}
