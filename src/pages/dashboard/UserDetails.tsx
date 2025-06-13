import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Wallet, Calendar, Building2, ArrowUpRight, ArrowDownRight, RefreshCw, Shield } from 'lucide-react';
import Card from '../../components/Card';
import { format } from 'date-fns';

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [payoutPlans, setPayoutPlans] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchUserData();
    }
  }, [id]);

  const fetchUserData = async () => {
    try {
      setRefreshing(true);
      
      // Use the get_user_info RPC function to fetch comprehensive user data
      const { data: userData, error: userError } = await supabase
        .rpc('get_user_info', { target_user_id: id });
      
      if (userError) {
        console.error('Error fetching user data via RPC:', userError);
        // Fallback to original method if RPC fails
        await fetchUserDataFallback();
        return;
      }
      
      if (!userData || userData.length === 0) {
        console.log('No user data returned from RPC');
        setUser(null);
        return;
      }
      
      const userInfo = userData[0];
      console.log('User data from RPC:', userInfo);
      
      // Set user data
      setUser({
        id: userInfo.id,
        first_name: userInfo.first_name,
        last_name: userInfo.last_name,
        email: userInfo.email,
        created_at: userInfo.date_joined,
        is_admin: userInfo.is_admin,
        wallets: [{
          balance: userInfo.available_balance || 0,
          locked_balance: userInfo.locked_balance || 0
        }]
      });
      
      // Set transactions from RPC data
      setTransactions(userInfo.recent_transactions || []);
      
      // Set payout plans from RPC data
      setPayoutPlans(userInfo.payout_plans || []);
      
      // Fetch bank accounts separately (not included in RPC)
      const { data: accountData, error: accountError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });
      
      if (accountError) {
        console.error('Error fetching bank accounts:', accountError);
      } else {
        setBankAccounts(accountData || []);
      }
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      await fetchUserDataFallback();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserDataFallback = async () => {
    try {
      // Fallback to original query method
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          created_at,
          updated_at,
          is_admin,
          wallets (
            balance,
            locked_balance
          )
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (userError) throw userError;
      setUser(userData);
      
      // Only fetch related data if user exists
      if (userData) {
        // Fetch user transactions
        const { data: transactionData, error: transactionError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false });
        
        if (transactionError) throw transactionError;
        setTransactions(transactionData || []);
        
        // Fetch user payout plans
        const { data: planData, error: planError } = await supabase
          .from('payout_plans')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false });
        
        if (planError) throw planError;
        setPayoutPlans(planData || []);
        
        // Fetch user bank accounts
        const { data: accountData, error: accountError } = await supabase
          .from('bank_accounts')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false });
        
        if (accountError) throw accountError;
        setBankAccounts(accountData || []);
      }
    } catch (error) {
      console.error('Error in fallback user data fetch:', error);
    }
  };

  // Calculate user stats
  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalPayouts = transactions
    .filter(t => t.type === 'payout')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const activePlans = payoutPlans.filter(p => p.status === 'active').length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-error dark:text-error mb-4">User not found</h2>
        <p className="text-text-secondary dark:text-text-secondary mb-6">
          The user you're looking for doesn't exist or may have been removed.
        </p>
        <Link 
          to="/users"
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link 
            to="/users"
            className="mr-4 p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-text dark:text-text" />
          </Link>
          <h1 className="text-2xl font-bold text-text dark:text-text">User Details</h1>
        </div>
        <button 
          onClick={fetchUserData}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-semibold">
          {user.first_name?.[0]}{user.last_name?.[0]}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text dark:text-text">{user.first_name} {user.last_name}</h2>
            {user.is_admin && (
              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Admin
              </span>
            )}
          </div>
          <p className="text-text-secondary dark:text-text-secondary">{user.email}</p>
          <p className="text-text-tertiary dark:text-text-tertiary text-sm">
            Joined: {format(new Date(user.created_at), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="flex flex-col items-center p-4">
          <div className="flex justify-between items-center w-full mb-2">
            <span className="text-text-secondary dark:text-text-secondary text-sm">Available Balance</span>
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <div className="text-xl font-bold text-text dark:text-text self-start">₦{user.wallets?.[0]?.balance.toLocaleString() || '0'}</div>
        </Card>

        <Card className="flex flex-col items-center p-4">
          <div className="flex justify-between items-center w-full mb-2">
            <span className="text-text-secondary dark:text-text-secondary text-sm">Total Deposits</span>
            <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-green-500" />
            </div>
          </div>
          <div className="text-xl font-bold text-text dark:text-text self-start">₦{totalDeposits.toLocaleString()}</div>
        </Card>

        <Card className="flex flex-col items-center p-4">
          <div className="flex justify-between items-center w-full mb-2">
            <span className="text-text-secondary dark:text-text-secondary text-sm">Total Payouts</span>
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <ArrowDownRight className="h-5 w-5 text-red-500" />
            </div>
          </div>
          <div className="text-xl font-bold text-text dark:text-text self-start">₦{totalPayouts.toLocaleString()}</div>
        </Card>

        <Card className="flex flex-col items-center p-4">
          <div className="flex justify-between items-center w-full mb-2">
            <span className="text-text-secondary dark:text-text-secondary text-sm">Active Plans</span>
            <div className="w-10 h-10 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
          <div className="text-xl font-bold text-text dark:text-text self-start">{activePlans}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-text dark:text-text mb-4">Wallet Information</h2>
          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <p className="text-text-secondary dark:text-text-secondary text-sm mb-1">Available Balance</p>
                <p className="text-lg font-semibold text-text dark:text-text">₦{user.wallets?.[0]?.balance.toLocaleString() || '0'}</p>
              </div>
              <div>
                <p className="text-text-secondary dark:text-text-secondary text-sm mb-1">Locked Balance</p>
                <p className="text-lg font-semibold text-text dark:text-text">₦{user.wallets?.[0]?.locked_balance.toLocaleString() || '0'}</p>
              </div>
              <div>
                <p className="text-text-secondary dark:text-text-secondary text-sm mb-1">Total Balance</p>
                <p className="text-lg font-semibold text-text dark:text-text">
                  ₦{((user.wallets?.[0]?.balance || 0) + (user.wallets?.[0]?.locked_balance || 0)).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-text dark:text-text mb-4">Linked Bank Accounts</h2>
          <Card className="overflow-hidden">
            {bankAccounts.length > 0 ? (
              <div className="divide-y divide-border dark:divide-border">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="p-4 flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mr-4">
                      <Building2 className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-text dark:text-text font-medium">{account.bank_name}</p>
                      <p className="text-text-secondary dark:text-text-secondary text-sm">•••• {account.account_number.slice(-4)}</p>
                      <p className="text-text-secondary dark:text-text-secondary text-sm">{account.account_name}</p>
                      {account.is_default && (
                        <span className="inline-block px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-500 text-xs rounded-full mt-1">
                          Default
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      account.status === 'active' 
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-500' 
                        : account.status === 'pending' 
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500' 
                          : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                    }`}>
                      {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-text-secondary dark:text-text-secondary">No bank accounts linked</p>
            )}
          </Card>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text dark:text-text mb-4">Payout Plans</h2>
        <Card className="overflow-hidden">
          {payoutPlans.length > 0 ? (
            <div className="divide-y divide-border dark:divide-border">
              {payoutPlans.map((plan) => (
                <div key={plan.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-text dark:text-text font-medium">{plan.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      plan.status === 'active' 
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-500' 
                        : plan.status === 'paused' 
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500' 
                          : plan.status === 'completed' 
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' 
                            : 'bg-gray-50 dark:bg-gray-900/20 text-gray-500'
                    }`}>
                      {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-text-secondary dark:text-text-secondary text-xs mb-1">Total Amount</p>
                      <p className="text-text dark:text-text text-sm font-medium">₦{plan.total_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary dark:text-text-secondary text-xs mb-1">Payout Amount</p>
                      <p className="text-text dark:text-text text-sm font-medium">₦{plan.payout_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary dark:text-text-secondary text-xs mb-1">Frequency</p>
                      <p className="text-text dark:text-text text-sm font-medium">
                        {plan.frequency.charAt(0).toUpperCase() + plan.frequency.slice(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-secondary dark:text-text-secondary text-xs mb-1">Progress</p>
                      <p className="text-text dark:text-text text-sm font-medium">{plan.completed_payouts}/{plan.duration}</p>
                    </div>
                  </div>
                  <div className="w-full bg-border dark:bg-border h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full rounded-full" 
                      style={{ width: `${Math.round((plan.completed_payouts / plan.duration) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-text-secondary dark:text-text-secondary">No payout plans found</p>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text dark:text-text mb-4">Recent Transactions</h2>
        <Card className="overflow-hidden">
          {transactions.length > 0 ? (
            <div className="divide-y divide-border dark:divide-border">
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="p-4 flex justify-between items-center">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'deposit' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                    }`}>
                      {transaction.type === 'deposit' ? (
                        <ArrowUpRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className="ml-4">
                      <p className="text-text dark:text-text font-medium">
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </p>
                      <p className="text-text-secondary dark:text-text-secondary text-sm">
                        {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full mt-1 ${
                        transaction.status === 'completed' 
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-500' 
                          : transaction.status === 'pending' 
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500' 
                            : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                      }`}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <p className={`font-semibold ${
                    transaction.type === 'deposit' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-text-secondary dark:text-text-secondary">No transactions found</p>
          )}
          {transactions.length > 5 && (
            <div className="border-t border-border dark:border-border p-4 text-center">
              <button className="text-primary dark:text-primary-light hover:underline text-sm font-medium">
                View All Transactions
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}