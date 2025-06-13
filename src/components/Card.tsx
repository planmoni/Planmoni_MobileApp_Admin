import { ReactNode } from 'react';

type CardProps = {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export default function Card({ title, children, footer, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow border border-border overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text">{title}</h3>
        </div>
      )}
      
      <div className="p-4">
        {children}
      </div>
      
      {footer && (
        <div className="px-4 py-3 border-t border-border">
          {footer}
        </div>
      )}
    </div>
  );
}