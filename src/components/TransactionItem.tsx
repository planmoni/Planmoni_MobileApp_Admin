import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';

type TransactionItemProps = {
  transaction: {
    id: string;
    type: string;
    amount: number;
    status: string;
    created_at: string;
    profiles?: {
      first_name?: string;
      last_name?: string;
    };
  };
};

export default function TransactionItem({ transaction }: TransactionItemProps) {
  const isDeposit = transaction.type === 'deposit';
  
  return (
    <div className="flex justify-between items-center p-4 hover:bg-background-tertiary dark:hover:bg-background-tertiary/20 transition-colors">
      <div className="flex items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isDeposit ? 'bg-success-light dark:bg-success-light/20' : 'bg-error-light dark:bg-error-light/20'
        }`}>
          {isDeposit ? (
            <ArrowUpRight className="h-5 w-5 text-success dark:text-success" />
          ) : (
            <ArrowDownRight className="h-5 w-5 text-error dark:text-error" />
          )}
        </div>
        <div className="ml-3">
          <p className="text-sm font-semibold text-text dark:text-text">
            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
          </p>
          <p className="text-xs text-text-secondary dark:text-text-secondary">
            {transaction.profiles?.first_name} {transaction.profiles?.last_name}
          </p>
          <p className="text-xs text-text-tertiary dark:text-text-tertiary">
            {format(new Date(transaction.created_at), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
      <p className={`text-sm font-semibold ${
        isDeposit ? 'text-success dark:text-success' : 'text-error dark:text-error'
      }`}>
        {isDeposit ? '+' : '-'}₦{transaction.amount.toLocaleString()}
      </p>
    </div>
  );
}