import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ComingSoon from './pages/ComingSoon'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sale/new" element={<ComingSoon title="New sale" />} />
        <Route path="/sales" element={<ComingSoon title="All sales" />} />
        <Route path="/stock" element={<ComingSoon title="Stock management" />} />
        <Route path="/stock/add" element={<ComingSoon title="Add stock" />} />
        <Route path="/customers/new" element={<ComingSoon title="New customer" />} />
        <Route path="/low-stock" element={<ComingSoon title="Low stock" />} />
        <Route path="/reports" element={<ComingSoon title="Sales report" />} />
        <Route path="/settings" element={<ComingSoon title="Settings" />} />
      </Routes>
    </Layout>
  )
}
