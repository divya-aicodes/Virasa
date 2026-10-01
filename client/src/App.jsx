import { Outlet } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';

export default function App() {
  return (
    <div className="grain min-h-screen bg-paper-100">
      <Navbar />
      <Outlet />
    </div>
  );
}