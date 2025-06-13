import { useEffect } from 'react';

export default function LoadingScreen() {
  useEffect(() => {
    console.log('Loading screen mounted');
  }, []);
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 border-4 border-primary-light border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-lg text-text-secondary">Loading...</p>
      </div>
    </div>
  );
}