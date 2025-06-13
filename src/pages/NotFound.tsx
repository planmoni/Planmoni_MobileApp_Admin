import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function NotFound() {
  const { session } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background dark:bg-background">
      <h1 className="text-4xl font-bold text-text dark:text-text mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-text dark:text-text mb-2">Page Not Found</h2>
      <p className="text-text-secondary dark:text-text-secondary mb-8 text-center">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to={session ? '/' : '/login'}
        className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
      >
        {session ? 'Go to Dashboard' : 'Back to Login'}
      </Link>
    </div>
  );
}