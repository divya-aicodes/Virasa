import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Landing from './pages/Landing.jsx';
import Gallery from './pages/Gallery.jsx';
import ProductPage from './pages/ProductPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import ArtisanPanel from './pages/ArtisanPanel.jsx';
import Admin from './pages/Admin.jsx';
import Login from './pages/Login.jsx';
import AccountAction from './pages/AccountAction.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { AuthProvider } from './auth.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<Landing />} />
            <Route path="explore" element={<Gallery />} />
            <Route path="product/:id" element={<ProductPage />} />
            <Route path="verify" element={<VerifyPage />} />
            <Route
              path="artisan"
              element={
                <RequireAuth>
                  <ArtisanPanel />
                </RequireAuth>
              }
            />
            <Route
              path="admin"
              element={
                <RequireAdmin>
                  <Admin />
                </RequireAdmin>
              }
            />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email" element={<AccountAction />} />
          <Route path="/reset-password" element={<AccountAction />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
