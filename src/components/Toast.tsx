import { useEffect, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';
import { X } from 'lucide-react';

export default function Toast() {
  const { toast, hideToast } = useToast();
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (toast.visible) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = window.setTimeout(() => {
        hideToast();
      }, toast.duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toast.visible, toast.duration, hideToast]);

  if (!toast.visible) return null;

  const getToastColors = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-l-4 border-green-500 text-green-800';
      case 'error':
        return 'bg-red-50 border-l-4 border-red-500 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 border-l-4 border-blue-500 text-blue-800';
    }
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className={`rounded-md shadow-md ${getToastColors()} p-4 flex items-center justify-between`}>
        <p className="text-sm font-medium">{toast.message}</p>
        <button
          onClick={hideToast}
          className="ml-4 inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}