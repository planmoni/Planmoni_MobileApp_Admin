import { useState, useEffect } from 'react';
import { Clock, Send } from 'lucide-react';

interface ScheduledNotificationCountdownProps {
  scheduledFor: string;
  notificationId: string;
  onTimeUp: (notificationId: string) => void;
  isProcessing: boolean;
}

export default function ScheduledNotificationCountdown({
  scheduledFor,
  notificationId,
  onTimeUp,
  isProcessing,
}: ScheduledNotificationCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isDue, setIsDue] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const scheduledTime = new Date(scheduledFor).getTime();
      const diff = scheduledTime - now;

      if (diff <= 0) {
        setIsDue(true);
        setTimeRemaining('Due now');
        if (!isProcessing) {
          onTimeUp(notificationId);
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [scheduledFor, notificationId, onTimeUp, isProcessing]);

  if (isDue && !isProcessing) {
    return (
      <div className="flex items-center space-x-2 text-orange-600">
        <Send className="h-4 w-4 animate-pulse" />
        <span className="text-sm font-medium">Sending...</span>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex items-center space-x-2 text-blue-600">
        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
        <span className="text-sm font-medium">Processing...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-gray-600">
      <Clock className="h-4 w-4" />
      <span className="text-sm font-medium">{timeRemaining}</span>
    </div>
  );
}
