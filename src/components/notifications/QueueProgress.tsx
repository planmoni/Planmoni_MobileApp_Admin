import { Pause, Play, RotateCcw, XCircle } from 'lucide-react';
import { type PushControlAction, type PushNotification, usePushControl, usePushProgress } from '@/hooks/queries/useNotifications';
import { useToast } from '@/contexts/ToastContext';
import { usePermissions } from '@/contexts/PermissionsContext';

function formatEta(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  if (seconds < 60) return 'under a minute left';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `about ${minutes} min left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `about ${h}h ${m}m left`;
}

/** Live progress and controls for a notification that goes through the queue. */
export default function QueueProgress({ notification }: { notification: PushNotification }) {
  const { showToast } = useToast();
  const control = usePushControl();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canControl = isSuperAdmin || hasPermission('notifications.send') || hasPermission('notifications.create');

  const active = notification.status === 'sending' || notification.status === 'paused';
  const finished = notification.status === 'sent' || notification.status === 'failed';
  const hasFailures = finished && notification.failed_count > 0;
  // while sending: live progress; after: one look at how many failed devices can still be retried
  const { data: progress } = usePushProgress(notification.id, !!notification.queue_enabled && (active || hasFailures), active);

  if (!notification.queue_enabled) return null;

  const run = (action: PushControlAction) => {
    if (action === 'cancel' && !window.confirm('Stop this send? Devices already notified stay notified; the rest are skipped.')) return;
    control.mutate(
      { id: notification.id, action },
      {
        onSuccess: (result) => {
          if (action === 'retry_failed') {
            const requeued = Number(result?.requeued) || 0;
            const unreachable = Number(result?.unreachable) || 0;
            if (requeued > 0) {
              showToast(
                `${requeued.toLocaleString()} device${requeued === 1 ? '' : 's'} put back in the queue` +
                  (unreachable > 0 ? `; ${unreachable.toLocaleString()} can't be reached` : ''),
                'success',
              );
            } else {
              showToast(
                `Nothing to retry: ${unreachable.toLocaleString()} failed device${unreachable === 1 ? '' : 's'} can't be reached (app uninstalled or token expired)`,
                'warning',
              );
            }
          } else {
            showToast(action === 'pause' ? 'Send paused' : action === 'resume' ? 'Send resumed' : 'Send cancelled', 'success');
          }
        },
        onError: (e) => showToast(e instanceof Error ? e.message : 'Action failed', 'error'),
      },
    );
  };

  const total = progress?.total ?? notification.total_recipients ?? 0;
  const done = total - (progress?.remaining ?? 0);
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const button =
    'inline-flex items-center space-x-1 px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50';

  return (
    <div className="mt-2 min-w-[200px]">
      {active && (
        <>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {done.toLocaleString()} / {total.toLocaleString()} devices
            {notification.status === 'sending' && progress?.eta_seconds != null && ` · ${formatEta(progress.eta_seconds)}`}
            {notification.status === 'paused' && ' · paused'}
            {progress?.rate_per_minute ? ` · ${progress.rate_per_minute.toLocaleString()}/min` : ''}
          </div>
        </>
      )}

      {hasFailures && progress && progress.unreachable > 0 && (
        <div
          className="mt-2 text-xs text-gray-500"
          title="Their app was uninstalled or the device token expired. These devices are switched off and are not retried."
        >
          {progress.unreachable.toLocaleString()} device{progress.unreachable === 1 ? '' : 's'} unreachable (app removed)
        </div>
      )}

      {canControl && (
        <div className="mt-2 flex flex-wrap gap-2">
          {notification.status === 'sending' && (
            <button className={button} disabled={control.isPending} onClick={() => run('pause')}>
              <Pause className="h-3 w-3" />
              <span>Pause</span>
            </button>
          )}
          {notification.status === 'paused' && (
            <button className={button} disabled={control.isPending} onClick={() => run('resume')}>
              <Play className="h-3 w-3" />
              <span>Resume</span>
            </button>
          )}
          {active && (
            <button className={button} disabled={control.isPending} onClick={() => run('cancel')}>
              <XCircle className="h-3 w-3" />
              <span>Cancel</span>
            </button>
          )}
          {hasFailures && (progress?.retryable ?? 0) > 0 && (
            <button className={button} disabled={control.isPending} onClick={() => run('retry_failed')}>
              <RotateCcw className="h-3 w-3" />
              <span>Retry {progress!.retryable.toLocaleString()} failed</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
