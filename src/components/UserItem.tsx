import { Link } from 'react-router-dom';

type UserItemProps = {
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    created_at: string;
    wallets?: {
      balance: number;
      locked_balance: number;
    }[];
  };
};

export default function UserItem({ user }: UserItemProps) {
  return (
    <div className="flex justify-between items-center p-4 hover:bg-background-tertiary dark:hover:bg-background-tertiary/20 transition-colors">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
          <span className="text-sm font-medium">
            {user.first_name?.[0]}{user.last_name?.[0]}
          </span>
        </div>
        <div className="ml-3">
          <p className="text-sm font-semibold text-text dark:text-text">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs text-text-secondary dark:text-text-secondary">{user.email}</p>
          <p className="text-xs text-text-tertiary dark:text-text-tertiary">
            Joined: {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-text-secondary dark:text-text-secondary">Balance</p>
          <p className="text-sm font-medium text-text dark:text-text">
            ₦{user.wallets?.[0]?.balance.toLocaleString() || '0'}
          </p>
        </div>
        <Link 
          to={`/users/${user.id}`}
          className="px-3 py-1 text-xs font-medium text-primary dark:text-primary-light bg-background-tertiary dark:bg-background-tertiary rounded hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
        >
          View
        </Link>
      </div>
    </div>
  );
}