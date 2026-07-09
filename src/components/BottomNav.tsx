import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Link as LinkIcon, Plus, BarChart3, Settings } from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/links', icon: LinkIcon, label: 'Links' },
  { path: '/links/new', icon: Plus, label: 'New', isCenter: true },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/links/new' && item.path !== '/links' && location.pathname.startsWith(item.path));
          
          if (item.isCenter) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative -top-6 flex items-center justify-center w-14 h-14 bg-blue-600 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                aria-label={item.label}
              >
                <item.icon className="w-6 h-6 text-white" strokeWidth={2.5} />
              </Link>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-blue-500' : 'text-gray-400'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
