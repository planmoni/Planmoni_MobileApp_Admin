import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';

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

      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between h-16 px-4">
          <img
            src="/assets/images/planmoni_logo_main.png"
            alt="Planmoni Office"
            className="h-10 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
              if (nextElement) {
                nextElement.style.display = 'block';
              }
            }}
          />
          <h1 className="text-lg font-bold text-primary" style={{ display: 'none' }}>
            Planmoni Admin
          </h1>
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 md:pl-64">
        <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
