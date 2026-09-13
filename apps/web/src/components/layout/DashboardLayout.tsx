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
  return (
    <div className="dashboard-root">
      <Navbar />
      <div className="dashboard-body">
        <Sidebar />
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
