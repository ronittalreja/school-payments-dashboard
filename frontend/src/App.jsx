import React, {  useEffect   } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useRouter } from './contexts/RouterContext';

import {
  LayoutDashboard,
  CreditCard,
  School,
  Search,
  Plus,
  TrendingUp,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  ExternalLink,
  Filter,
  Calendar,
  RefreshCw,
  Sun,
  Moon,
  LogOut,
  User,
  Bell,
  Settings,
  DollarSign,
  Activity,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Home
} from 'lucide-react';


import { ThemeProvider } from './contexts/ThemeContext';
import { Router } from './contexts/RouterContext';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/Dashboard';
import TransactionsPage from './pages/TransactionsPage';
import SchoolTransactionsPage from './pages/SchoolTransactionsPage';
import TransactionStatusPage from './pages/TransactionStatusPage';
import CreatePaymentPage from './pages/CreatePaymentPage';

const App = () => {
  const { user, loading } = useAuth();
  const { currentPath, navigate } = useRouter();

  useEffect(() => {
    // Redirect logic
    if (!loading) {
      if (!user && !['/', '/login', '/register'].includes(currentPath)) {
        navigate('/login');
      } else if (user && ['/login', '/register'].includes(currentPath)) {
        navigate('/dashboard');
      }
    }
  }, [user, loading, currentPath, navigate]);

  if (loading) {
    return <LoadingSpinner text="Initializing..." />;
  }

  // Public routes
  if (!user) {
    if (currentPath === '/register') {
      return <Register />;
    }
    return <Login />;
  }

  // Protected routes
  const renderPage = () => {
    switch (currentPath) {
      case '/dashboard':
        return <Dashboard />;
      case '/transactions':
        return <TransactionsPage />;
      case '/school-transactions':
        return <SchoolTransactionsPage />;
      case '/transaction-status':
        return <TransactionStatusPage />;
      case '/create-payment':
        return <CreatePaymentPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex">
        <Sidebar />
        <div className="flex-1">
          <Header />
          <main className="p-6">
            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  );
};
// Root Component with Providers
const Root = () => {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default Root;