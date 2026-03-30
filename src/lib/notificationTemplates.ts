export interface NotificationTemplate {
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
}

export const NOTIFICATION_CATEGORIES = {
  PAYOUT_COMPLETED: 'payout_completed',
  PAYOUT_SCHEDULED: 'payout_scheduled',
  PAYOUT_READY: 'payout_ready',
  PAYOUT_FAILED: 'payout_failed',
  DISBURSEMENT_FAILED: 'disbursement_failed',
  DEPOSIT_SUCCESSFUL: 'deposit_successful',
  DEPOSIT_RECEIVED: 'deposit_received',
  DEPOSIT_FAILED: 'deposit_failed',
  TRANSACTION_COMPLETED: 'transaction_completed',
  TRANSACTION_FAILED: 'transaction_failed',
  PLAN_EXPIRY_REMINDER: 'plan_expiry_reminder',
  DAILY_DIGEST: 'daily_digest',
  RE_ENGAGEMENT: 're_engagement',
  NO_PLAN_YET: 'no_plan_yet',
  DEPOSIT_NO_PLAN: 'deposit_no_plan',
  ZERO_BALANCE_REMINDER: 'zero_balance_reminder',
  VAULT_UNFUNDED_REMINDER: 'vault_unfunded_reminder',
  VAULT_SCHEDULE_CREATED: 'vault_schedule_created',
  VAULT_PAYOUT_COMPLETED: 'vault_payout_completed',
  VAULT_LOW_BALANCE: 'vault_low_balance',
  VAULT_PAYOUT_DUE: 'vault_payout_due',
  STREAK: 'streak',
  SECURITY_ALERT: 'security_alert',
  LOGIN_ALERT: 'login_alert',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
} as const;

export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[keyof typeof NOTIFICATION_CATEGORIES];

export const REENGAGEMENT_TEMPLATES: Record<string, NotificationTemplate> = {
  [NOTIFICATION_CATEGORIES.ZERO_BALANCE_REMINDER]: {
    title: '💰 Your Wallet Needs Attention',
    body: 'Your wallet balance is empty. Add funds to start saving again and reach your goals!',
    data: {
      type: 'zero_balance_reminder',
      screen: 'Wallet',
      action: 'deposit',
    },
    sound: 'default',
    priority: 'high',
  },
  [NOTIFICATION_CATEGORIES.VAULT_UNFUNDED_REMINDER]: {
    title: '🏦 Your Vault is Waiting',
    body: 'Fund your vault to activate automatic savings and watch your money grow!',
    data: {
      type: 'vault_unfunded_reminder',
      screen: 'Vaults',
      action: 'fund_vault',
    },
    sound: 'default',
    priority: 'high',
  },
  [NOTIFICATION_CATEGORIES.DEPOSIT_NO_PLAN]: {
    title: '📋 Complete Your Setup',
    body: "You've deposited funds but haven't created a savings plan yet. Create one now to start earning!",
    data: {
      type: 'deposit_no_plan',
      screen: 'CreatePlan',
      action: 'create_plan',
    },
    sound: 'default',
    priority: 'high',
  },
  [NOTIFICATION_CATEGORIES.NO_PLAN_YET]: {
    title: '👋 Welcome to Planmoni!',
    body: 'Complete your setup by creating your first savings plan and start your journey to financial freedom.',
    data: {
      type: 'no_plan_yet',
      screen: 'CreatePlan',
      action: 'create_plan',
    },
    sound: 'default',
    priority: 'normal',
  },
  [NOTIFICATION_CATEGORIES.RE_ENGAGEMENT]: {
    title: '🌟 We Miss You!',
    body: "It's been a while since your last visit. Come back and continue your savings journey with PlanMoni!",
    data: {
      type: 're_engagement',
      screen: 'Dashboard',
      action: 'open_app',
    },
    sound: 'default',
    priority: 'normal',
  },
};

export const SYSTEM_NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  [NOTIFICATION_CATEGORIES.PAYOUT_COMPLETED]: {
    title: '✅ Payout Successful',
    body: 'Your payout has been sent successfully!',
    data: {
      type: 'payout_completed',
      screen: 'Transactions',
    },
    sound: 'default',
    priority: 'high',
  },
  [NOTIFICATION_CATEGORIES.PAYOUT_SCHEDULED]: {
    title: '📅 Payout Scheduled',
    body: 'Your payout has been scheduled and will be processed soon.',
    data: {
      type: 'payout_scheduled',
      screen: 'Transactions',
    },
    sound: 'default',
    priority: 'normal',
  },
  [NOTIFICATION_CATEGORIES.PAYOUT_READY]: {
    title: '⏰ Payout Ready',
    body: 'Your payout is due and ready to be processed!',
    data: {
      type: 'payout_ready',
      screen: 'Transactions',
    },
    sound: 'default',
    priority: 'high',
  },
  [NOTIFICATION_CATEGORIES.PAYOUT_FAILED]: {
    title: '❌ Payout Failed',
    body: 'Your payout attempt failed. Please check your account details.',
    data: {
      type: 'payout_failed',
      screen: 'Transactions',
    },
    sound: 'default',
    priority: 'high',
  },
  [NOTIFICATION_CATEGORIES.DEPOSIT_SUCCESSFUL]: {
    title: '💵 Deposit Received',
    body: 'Your deposit has been confirmed and added to your wallet!',
    data: {
      type: 'deposit_successful',
      screen: 'Wallet',
    },
    sound: 'default',
    priority: 'high',
  },
  [NOTIFICATION_CATEGORIES.DEPOSIT_FAILED]: {
    title: '❌ Deposit Failed',
    body: 'Your deposit attempt failed. Please try again.',
    data: {
      type: 'deposit_failed',
      screen: 'Wallet',
    },
    sound: 'default',
    priority: 'high',
  },
  [NOTIFICATION_CATEGORIES.TRANSACTION_COMPLETED]: {
    title: '✅ Transaction Completed',
    body: 'Your transaction has been completed successfully.',
    data: {
      type: 'transaction_completed',
      screen: 'Transactions',
    },
    sound: 'default',
    priority: 'normal',
  },
  [NOTIFICATION_CATEGORIES.VAULT_PAYOUT_COMPLETED]: {
    title: '🏦 Vault Payout Complete',
    body: 'Your vault payout has been processed successfully!',
    data: {
      type: 'vault_payout_completed',
      screen: 'Vaults',
    },
    sound: 'default',
    priority: 'high',
  },
  [NOTIFICATION_CATEGORIES.VAULT_LOW_BALANCE]: {
    title: '⚠️ Low Vault Balance',
    body: 'Your vault balance is running low. Consider adding more funds.',
    data: {
      type: 'vault_low_balance',
      screen: 'Vaults',
    },
    sound: 'default',
    priority: 'normal',
  },
  [NOTIFICATION_CATEGORIES.SECURITY_ALERT]: {
    title: '🔒 Security Alert',
    body: 'Unusual activity detected on your account. Please review.',
    data: {
      type: 'security_alert',
      screen: 'Settings',
    },
    sound: 'default',
    priority: 'high',
  },
};

export interface ReengagementCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  template: NotificationTemplate;
  preferenceKey?: string;
}

export const REENGAGEMENT_CATEGORIES: ReengagementCategory[] = [
  {
    id: NOTIFICATION_CATEGORIES.ZERO_BALANCE_REMINDER,
    title: 'Zero Balance Reminder',
    description: 'Send alerts to users with empty wallets for 3+ days',
    icon: '💰',
    template: REENGAGEMENT_TEMPLATES[NOTIFICATION_CATEGORIES.ZERO_BALANCE_REMINDER],
    preferenceKey: 'general',
  },
  {
    id: NOTIFICATION_CATEGORIES.VAULT_UNFUNDED_REMINDER,
    title: 'Unfunded Vault Reminder',
    description: 'Notify users with active but unfunded vaults',
    icon: '🏦',
    template: REENGAGEMENT_TEMPLATES[NOTIFICATION_CATEGORIES.VAULT_UNFUNDED_REMINDER],
    preferenceKey: 'vault_alerts',
  },
  {
    id: NOTIFICATION_CATEGORIES.DEPOSIT_NO_PLAN,
    title: 'Deposit Without Plan',
    description: 'Remind users who deposited funds but created no plan',
    icon: '📋',
    template: REENGAGEMENT_TEMPLATES[NOTIFICATION_CATEGORIES.DEPOSIT_NO_PLAN],
    preferenceKey: 'plan_reminders',
  },
  {
    id: NOTIFICATION_CATEGORIES.NO_PLAN_YET,
    title: 'No Plan Created',
    description: 'Engage users who signed up but never created a plan',
    icon: '👋',
    template: REENGAGEMENT_TEMPLATES[NOTIFICATION_CATEGORIES.NO_PLAN_YET],
    preferenceKey: 'plan_reminders',
  },
  {
    id: NOTIFICATION_CATEGORIES.RE_ENGAGEMENT,
    title: 'Inactive User Reminder',
    description: 'Win-back nudges for users inactive for 14+ days',
    icon: '🌟',
    template: REENGAGEMENT_TEMPLATES[NOTIFICATION_CATEGORIES.RE_ENGAGEMENT],
    preferenceKey: 'general',
  },
];

export function getNotificationTemplate(category: string): NotificationTemplate | null {
  return REENGAGEMENT_TEMPLATES[category] || SYSTEM_NOTIFICATION_TEMPLATES[category] || null;
}

export function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    payout_completed: 'Payout Completed',
    payout_scheduled: 'Payout Scheduled',
    payout_ready: 'Payout Ready',
    payout_failed: 'Payout Failed',
    disbursement_failed: 'Disbursement Failed',
    deposit_successful: 'Deposit Successful',
    deposit_received: 'Deposit Received',
    deposit_failed: 'Deposit Failed',
    transaction_completed: 'Transaction Completed',
    transaction_failed: 'Transaction Failed',
    plan_expiry_reminder: 'Plan Expiry Reminder',
    daily_digest: 'Daily Digest',
    re_engagement: 'Re-engagement',
    no_plan_yet: 'No Plan Created',
    deposit_no_plan: 'Deposit Without Plan',
    zero_balance_reminder: 'Zero Balance Reminder',
    vault_unfunded_reminder: 'Unfunded Vault Reminder',
    vault_schedule_created: 'Vault Schedule Created',
    vault_payout_completed: 'Vault Payout Completed',
    vault_low_balance: 'Low Vault Balance',
    vault_payout_due: 'Vault Payout Due',
    streak: 'Streak Reminder',
    security_alert: 'Security Alert',
    login_alert: 'Login Alert',
    suspicious_activity: 'Suspicious Activity',
  };

  return categoryMap[category] || category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
