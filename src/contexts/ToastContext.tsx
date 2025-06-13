import { createContext, useContext, useState, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastContextType = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
  toast: {
    visible: boolean;
    message: string;
    type: ToastType;
    duration: number;
  };
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as ToastType,
    duration: 3000,
  });

  const showToast = (
    message: string,
    type: ToastType = 'info',
    duration: number = 3000
  ) => {
    setToast({
      visible: true,
      message,
      type,
      duration,
    });
  };

  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      visible: false,
    }));
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}