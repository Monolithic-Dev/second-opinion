import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppStateProvider } from './hooks/useAppState';
import { AuthProvider } from './hooks/useAuth';
import { Demo } from './routes/Demo';
import { Landing } from './routes/Landing';
import { Circle } from './routes/console/Circle';
import { Console } from './routes/console/Console';
import { Dashboard } from './routes/console/Dashboard';
import { HoldDetailPage } from './routes/console/HoldDetailPage';
import { Holds } from './routes/console/Holds';
import { Inbox } from './routes/console/Inbox';
import { InsightsPage } from './routes/console/Insights';
import { PolicyPage } from './routes/console/PolicyPage';
import { Profile } from './routes/console/Profile';

export function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/family" element={<Console />}>
              <Route index element={<Dashboard />} />
              <Route path="holds" element={<Holds />} />
              <Route path="holds/:holdId" element={<HoldDetailPage />} />
              <Route path="circle" element={<Circle />} />
              <Route path="policy" element={<PolicyPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AppStateProvider>
    </AuthProvider>
  );
}
