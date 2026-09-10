import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import ErrorBoundary from '@/components/ErrorBoundary'
import Gate from '@/components/Gate'
import HomePage from '@/pages/HomePage'
import BuilderPage from '@/pages/BuilderPage'
import JobsPage from '@/pages/JobsPage'
import ImportPage from '@/pages/ImportPage'
import HistoryPage from '@/pages/HistoryPage'
import VerificationPage from '@/pages/VerificationPage'
import PreviewPage from '@/pages/PreviewPage'
import ApplicationsPage from '@/pages/ApplicationsPage'
import SharePage from '@/pages/SharePage'
import UpgradePage from '@/pages/UpgradePage'
import AdminPage from '@/pages/AdminPage'
import AccountPage from '@/pages/AccountPage'
import LoginPage from '@/pages/LoginPage'

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route index element={<HomePage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/verify" element={<VerificationPage />} />
          <Route path="/preview" element={<PreviewPage />} />
          <Route
            path="/applications"
            element={
              <Gate reason="The application tracker is a Pro feature.">
                <ApplicationsPage />
              </Gate>
            }
          />
          <Route path="/share/:slug" element={<SharePage />} />
          <Route path="/upgrade" element={<UpgradePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
