import { useState } from 'react';
import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export interface DashboardLayoutProps {
  children: ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  headerAction?: ReactNode;
}

export function DashboardLayout({
  children,
  pageTitle,
  pageSubtitle,
  headerAction,
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="dashboard-root">
      <Navbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />
      <div className="dashboard-body">
        {isSidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="dashboard-content">
          {(pageTitle || headerAction) && (
            <div className="page-header">
              <div className="page-header-text">
                {pageTitle && <h1 className="page-title">{pageTitle}</h1>}
                {pageSubtitle && (
                  <p className="page-subtitle">{pageSubtitle}</p>
                )}
              </div>
              {headerAction && (
                <div className="page-header-action">{headerAction}</div>
              )}
            </div>
          )}
          <div className="page-content-wrapper">{children}</div>
        </main>
      </div>
    </div>
  );
}
