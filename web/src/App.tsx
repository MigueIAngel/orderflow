import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { EventsPage } from './pages/EventsPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrdersPage } from './pages/OrdersPage'
import { StorePage } from './pages/StorePage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StorePage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="architecture" element={<ArchitecturePage />} />
        <Route path="*" element={<StorePage />} />
      </Route>
    </Routes>
  )
}
