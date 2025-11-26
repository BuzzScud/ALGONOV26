import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import News from './pages/News';
import Trading from './pages/Trading';
import Projection from './pages/Projection';
import Data from './pages/Data';
import API from './pages/API';
import Settings from './pages/Settings';
import FIB from './pages/FIB';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="news" element={<News />} />
          <Route path="trading" element={<Trading />} />
          <Route path="projection">
            <Route index element={<Projection />} />
            <Route path="fib" element={<FIB />} />
          </Route>
          <Route path="data" element={<Data />} />
          <Route path="api" element={<API />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
