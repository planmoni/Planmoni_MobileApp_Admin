import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={closeMobileMenu} />

      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-10 bg-black bg-opacity-50"
          onClick={closeMobileMenu}
        ></div>
      )}

      <div className="flex flex-col flex-1 md:pl-64 min-w-0">
        <TopBar isMobileMenuOpen={isMobileMenuOpen} toggleMobileMenu={toggleMobileMenu} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="py-6 md:py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 w-full min-w-0">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
