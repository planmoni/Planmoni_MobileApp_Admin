import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background-secondary">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
      <footer className="py-4 text-center text-sm text-text-secondary">
        <p>© {new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </footer>
    </div>
  );
}