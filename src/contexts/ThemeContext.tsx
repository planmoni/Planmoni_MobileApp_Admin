import { createContext, useContext, useEffect, ReactNode } from 'react';

type ThemeContextType = {
  colors: typeof lightColors;
  isDark: boolean;
};

const lightColors = {
  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F8FAFC',
  backgroundTertiary: '#F1F5F9',
  
  // Surface colors
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  
  // Text colors
  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  
  // Primary colors
  primary: '#1E3A8A',
  primaryLight: '#3B82F6',
  primaryDark: '#1E40AF',
  
  // Status colors
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  
  // Border colors
  border: '#E2E8F0',
  borderSecondary: '#CBD5E1',
  
  // Card colors
  card: '#FFFFFF',
  cardSecondary: '#F8FAFC',
  
  // Modal overlay
  overlay: 'rgba(15, 23, 42, 0.8)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Remove dark mode detection and theme switching
  useEffect(() => {
    // Remove dark class if it exists
    document.documentElement.classList.remove('dark');
    
    // Set light mode CSS variables
    document.documentElement.style.setProperty('--color-background', '#FFFFFF');
    document.documentElement.style.setProperty('--color-background-secondary', '#F8FAFC');
    document.documentElement.style.setProperty('--color-background-tertiary', '#F1F5F9');
    document.documentElement.style.setProperty('--color-surface', '#FFFFFF');
    document.documentElement.style.setProperty('--color-surface-secondary', '#F8FAFC');
    document.documentElement.style.setProperty('--color-text', '#1E293B');
    document.documentElement.style.setProperty('--color-text-secondary', '#64748B');
    document.documentElement.style.setProperty('--color-text-tertiary', '#94A3B8');
    document.documentElement.style.setProperty('--color-primary', '#1E3A8A');
    document.documentElement.style.setProperty('--color-primary-light', '#3B82F6');
    document.documentElement.style.setProperty('--color-primary-dark', '#1E40AF');
    document.documentElement.style.setProperty('--color-success', '#22C55E');
    document.documentElement.style.setProperty('--color-success-light', '#DCFCE7');
    document.documentElement.style.setProperty('--color-warning', '#F59E0B');
    document.documentElement.style.setProperty('--color-warning-light', '#FEF3C7');
    document.documentElement.style.setProperty('--color-error', '#EF4444');
    document.documentElement.style.setProperty('--color-error-light', '#FEE2E2');
    document.documentElement.style.setProperty('--color-border', '#E2E8F0');
    document.documentElement.style.setProperty('--color-border-secondary', '#CBD5E1');
    document.documentElement.style.setProperty('--color-card', '#FFFFFF');
    document.documentElement.style.setProperty('--color-card-secondary', '#F8FAFC');
  }, []);

  return (
    <ThemeContext.Provider value={{ colors: lightColors, isDark: false }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}