import { Routes, Route } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import StockManagement from './pages/StockManagement'
import ManageStock from './pages/ManageStock'
import NewSale from './pages/NewSale'
import AllSales from './pages/AllSales'
import ManageCustomers from './pages/ManageCustomers'
import SalesReport from './pages/SalesReport'
import LowStock from './pages/LowStock'
import Settings from './pages/Settings'
import Chatbot from './pages/Chatbot'
import Login from './pages/Login'
import { useAuth } from './lib/auth'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sale/new" element={<NewSale />} />
        <Route path="/sales" element={<AllSales />} />
        <Route path="/catalog" element={<StockManagement />} />
        <Route path="/stock/add" element={<ManageStock />} />
        <Route path="/customers" element={<ManageCustomers />} />
        <Route path="/low-stock" element={<LowStock />} />
        <Route path="/reports" element={<SalesReport />} />
        <Route path="/chat" element={<Chatbot />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}
