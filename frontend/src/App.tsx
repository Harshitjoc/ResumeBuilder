import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import HomePage from '@/pages/HomePage'
import BuilderPage from '@/pages/BuilderPage'
import JobsPage from '@/pages/JobsPage'
import VerificationPage from '@/pages/VerificationPage'
import PreviewPage from '@/pages/PreviewPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/verify" element={<VerificationPage />} />
        <Route path="/preview" element={<PreviewPage />} />
      </Route>
    </Routes>
  )
}
