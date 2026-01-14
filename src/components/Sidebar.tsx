import { Link, useLocation } from 'react-router-dom';
import { Home, Users, FolderKanban, Library, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Suppliers', href: '/suppliers', icon: Users },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Activity Library', href: '/activity-library', icon: Library },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  function isActive(href: string) {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 flex-col justify-center border-b px-6">
        <h1 className="text-lg font-semibold">SQTS</h1>
        <span className="text-xs text-muted-foreground">Supplier Quality Tracking</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
