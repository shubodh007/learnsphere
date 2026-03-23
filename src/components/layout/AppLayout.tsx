import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useUIStore } from '@/stores/ui-store';

export function AppLayout() {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main
        className="transition-all duration-300 pb-16 md:pb-0"
        style={{ marginLeft: `var(--sidebar-width, 0px)` }}
      >
        <div
          className="hidden md:block"
          style={{
            ['--sidebar-width' as string]: sidebarOpen ? '240px' : '64px',
          }}
        />
        <div
          className="md:ml-0"
          style={{
            marginLeft: sidebarOpen ? '240px' : '64px',
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
