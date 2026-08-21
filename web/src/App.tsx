import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import AuthPages from './pages/AuthPages'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import OrdersPage from './pages/OrdersPage'
import TablesPage from './pages/TablesPage'
import StaffPage from './pages/StaffPage'
import AttendancePage from './pages/AttendancePage'
import PayrollPage from './pages/PayrollPage'
import ProcurementPage from './pages/ProcurementPage'
import ReportsPage from './pages/ReportsPage'
import AffiliatePage from './pages/AffiliatePage'
import AdminPage from './pages/AdminPage'
import ProfilePage from './pages/ProfilePage'
import ReferralLanding from './pages/ReferralLanding'
import QrMenuPage from './pages/QrMenuPage'

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPages mode="login" />} />
          <Route path="/register" element={<AuthPages mode="register" />} />
          <Route path="/r/:code" element={<ReferralLanding />} />
          <Route path="/menu/:tableId" element={<QrMenuPage />} />

          <Route
            path="/onboarding"
            element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>}
          />
          <Route
            path="/dashboard"
            element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/orders"
            element={<ProtectedRoute><Layout><OrdersPage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/products"
            element={<ProtectedRoute><Layout><ProductsPage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/tables"
            element={<ProtectedRoute><Layout><TablesPage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/staff"
            element={<ProtectedRoute><Layout><StaffPage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/attendance"
            element={<ProtectedRoute><Layout><AttendancePage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/payroll"
            element={<ProtectedRoute><Layout><PayrollPage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/procurement"
            element={<ProtectedRoute><Layout><ProcurementPage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/reports"
            element={<ProtectedRoute><Layout><ReportsPage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/affiliate"
            element={<ProtectedRoute><Layout><AffiliatePage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/admin"
            element={<ProtectedRoute><Layout><AdminPage /></Layout></ProtectedRoute>}
          />
          <Route
            path="/profile"
            element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  )
}
