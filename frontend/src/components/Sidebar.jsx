import React from 'react';
import {
  LayoutDashboard,
  CreditCard,
  School,
  Search,
  Plus,
  TrendingUp
} from 'lucide-react';
import { useRouter } from '../contexts/RouterContext';


const Sidebar = () => {
  const { currentPath, navigate } = useRouter();
  
  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/transactions', icon: CreditCard, label: 'All Transactions' },
    { to: '/school-transactions', icon: School, label: 'School Transactions' },
    { to: '/transaction-status', icon: Search, label: 'Check Status' },
    { to: '/create-payment', icon: Plus, label: 'Create Payment' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 w-64 min-h-screen shadow-lg">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">PaymentHub</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">School Management</p>
          </div>
        </div>
      </div>

      <nav className="mt-8">
        <div className="px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentPath === item.to
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      
    </div>
  );
};

export default Sidebar;