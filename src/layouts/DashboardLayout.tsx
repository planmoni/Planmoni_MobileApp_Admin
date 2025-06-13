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
    <div className="flex h-screen bg-background-secondary">
      {/* Sidebar for desktop and mobile */}
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} closeMobileMenu={closeMobileMenu} />

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-10 bg-black bg-opacity-50" 
          onClick={closeMobileMenu}
        ></div>
      )}

      {/* Mobile menu button */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-border">
        <div className="flex items-center justify-between h-16 px-4">
          <img
            src="/public/assets/images/Planmoni-Office.png"
            alt="Planmoni Office"
            className="h-6 w-auto"
            onError={(e) => {
              // Fallback to text if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling!.style.display = 'block';
            }}
          />
          <h1 className="text-lg font-bold text-primary" style={{ display: 'none' }}>
            Planmoni Admin
          </h1>
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-md text-text-secondary hover:text-text"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 md:pl-64">
        <header className="sticky top-0 z-10 md:flex items-center justify-between h-16 bg-white border-b border-border px-4 hidden">
          <h1 className="text-xl font-bold text-text">Dashboard</h1>
        </header>
        <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}