import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Activity, LogOut, Pause, Play, RefreshCw, ShieldOff, ShieldCheck, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { describeActivity, pageTitle } from '@/lib/adminActivity';
import {
  TEAM_FEED_KEY,
  TEAM_OVERVIEW_KEY,
  memberName,
  useActivityFeed,
  useTeamControls,
  useTeamOverview,
  type ActivityRow,
  type TeamMember,
} from '@/hooks/queries/useTeamMonitor';
import { ActiveSessionsManager } from '@/components/ActiveSessionsManager';
import ControlDialog from './ControlDialog';

type FeedFilter = 'all' | 'actions' | 'sessions';

const exact = (iso: string) => format(new Date(iso), 'd MMM yyyy, HH:mm:ss');
const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

const STATUS_STYLE: Record<TeamMember['status'], { dot: string; label: string }> = {
  online: { dot: 'bg-green-500', label: 'Online' },
  offline: { dot: 'bg-gray-300', label: 'Offline' },
  suspended: { dot: 'bg-red-500', label: 'Suspended' },
};

type Pending =
  | { type: 'logout'; member: TeamMember }
  | { type: 'suspend'; member: TeamMember }
  | { type: 'restore'; member: TeamMember }
  | { type: 'role'; member: TeamMember; roleId: string; roleName: string }
  | null;

export default function TeamMonitor() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const meId = session?.user?.id;

  const team = useTeamOverview();
  const controls = useTeamControls();
  const members = team.data ?? [];
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const byIdRef = useRef(byId);
  byIdRef.current = byId;

  const [filterUser, setFilterUser] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<FeedFilter>('all');
  const [showPageViews, setShowPageViews] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [live, setLive] = useState(true);
  const [, setTick] = useState(0);

  // which kinds of rows the feed shows (null = everything)
  const kinds = useMemo<string[] | null>(() => {
    const base =
      filterKind === 'actions' ? ['action', 'role', 'access'] : filterKind === 'sessions' ? ['login', 'logout'] : ['action', 'role', 'access', 'login', 'logout'];
    if (showPageViews) return filterKind === 'all' ? null : [...base, 'page_view'];
    return base;
  }, [filterKind, showPageViews]);

  const feed = useActivityFeed({ userId: filterUser, kinds });
  const fetchedRows = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);

  // rows that arrived over the socket since the last fetch
  const [liveRows, setLiveRows] = useState<ActivityRow[]>([]);
  const bufferRef = useRef<ActivityRow[]>([]);
  const [bufferedCount, setBufferedCount] = useState(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const filterRef = useRef({ filterUser, kinds });
  filterRef.current = { filterUser, kinds };

  useEffect(() => {
    setLiveRows([]);
    bufferRef.current = [];
    setBufferedCount(0);
  }, [filterUser, kinds]);

  const matches = (row: ActivityRow) => {
    const f = filterRef.current;
    return (!f.filterUser || row.user_id === f.filterUser) && (!f.kinds || f.kinds.includes(row.kind));
  };

  // relative times stay fresh
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 15 * 1000);
    return () => window.clearInterval(t);
  }, []);

  // realtime: new activity rows and session changes
  const overviewTimer = useRef<number | null>(null);
  const refreshOverviewSoon = useCallback(() => {
    if (overviewTimer.current) return;
    overviewTimer.current = window.setTimeout(() => {
      overviewTimer.current = null;
      queryClient.invalidateQueries({ queryKey: TEAM_OVERVIEW_KEY });
    }, 1500);
  }, [queryClient]);

  useEffect(() => {
    let wasDown = false;
    const channel = supabase
      .channel('admin-team-monitor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_activity' }, (payload) => {
        const raw = payload.new as Omit<ActivityRow, 'actor_name' | 'actor_email'>;
        const actor = byIdRef.current.get(raw.user_id);
        const row: ActivityRow = {
          ...raw,
          actor_name: actor ? memberName(actor) : null,
          actor_email: actor?.email ?? null,
        };
        if (raw.kind !== 'page_view') refreshOverviewSoon();
        if (!matches(row)) return;
        if (pausedRef.current) {
          bufferRef.current = [row, ...bufferRef.current];
          setBufferedCount(bufferRef.current.length);
        } else {
          setLiveRows((prev) => [row, ...prev].slice(0, 200));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_sessions' }, refreshOverviewSoon)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLive(true);
          if (wasDown) {
            wasDown = false;
            setLiveRows([]);
            queryClient.invalidateQueries({ queryKey: TEAM_FEED_KEY });
            queryClient.invalidateQueries({ queryKey: TEAM_OVERVIEW_KEY });
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasDown = true;
          setLive(false);
        }
      });
    return () => {
      if (overviewTimer.current) window.clearTimeout(overviewTimer.current);
      overviewTimer.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, refreshOverviewSoon]);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    return [...liveRows, ...fetchedRows]
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [liveRows, fetchedRows]);

  const resume = () => {
    setLiveRows((prev) => [...bufferRef.current, ...prev].slice(0, 200));
    bufferRef.current = [];
    setBufferedCount(0);
    setPaused(false);
  };

  const onError = (err: unknown, fallback: string) =>
    showToast((err as { message?: string })?.message || fallback, 'error');

  const runControl = async (values: { reason: string; checked: boolean }) => {
    if (!pending) return;
    const { member } = pending;
    try {
      if (pending.type === 'logout') {
        await controls.forceLogout.mutateAsync(member.id);
        showToast(`${memberName(member)} was signed out everywhere`, 'success');
      } else if (pending.type === 'suspend') {
        await controls.suspend.mutateAsync({ userId: member.id, reason: values.reason });
        showToast(`${memberName(member)} is suspended and signed out`, 'success');
      } else if (pending.type === 'restore') {
        await controls.unsuspend.mutateAsync(member.id);
        showToast(`${memberName(member)} can sign in again`, 'success');
      } else {
        await controls.removeRole.mutateAsync({ userId: member.id, roleId: pending.roleId, signOut: values.checked });
        showToast(`Removed ${pending.roleName} from ${memberName(member)}`, 'success');
      }
      setPending(null);
    } catch (err) {
      onError(err, 'That did not work');
    }
  };

  const busy = controls.forceLogout.isPending || controls.suspend.isPending || controls.unsuspend.isPending || controls.removeRole.isPending;
  const onlineCount = members.filter((m) => m.status === 'online').length;
  const suspendedCount = members.filter((m) => m.status === 'suspended').length;

  const dialog = (() => {
    if (!pending) return null;
    const name = memberName(pending.member);
    switch (pending.type) {
      case 'logout':
        return {
          title: 'Sign out everywhere',
          description: (
            <>
              <strong>{name}</strong> is signed out of every browser within about 30 seconds and has to sign in again. If they use
              the same account in the Planmoni mobile app, that sign-in ends too.
            </>
          ),
          confirmLabel: 'Sign out',
        };
      case 'suspend':
        return {
          title: 'Suspend access',
          description: (
            <>
              <strong>{name}</strong> is signed out now and cannot use the admin dashboard until you restore them. Their roles are kept.
            </>
          ),
          confirmLabel: 'Suspend',
          requireReason: true,
        };
      case 'restore':
        return {
          title: 'Restore access',
          description: (
            <>
              <strong>{name}</strong> will be able to sign in to the admin dashboard again with their existing roles.
            </>
          ),
          confirmLabel: 'Restore',
        };
      default:
        return {
          title: `Remove ${pending.roleName}`,
          description: (
            <>
              <strong>{name}</strong> loses the {pending.roleName} role and its permissions right away. You can assign it again later.
            </>
          ),
          confirmLabel: 'Remove role',
          checkboxLabel: 'Also sign them out everywhere',
        };
    }
  })();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-soft border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Team</h3>
            <p className="text-sm text-gray-600 mt-1">
              {onlineCount} online · {members.length} total{suspendedCount > 0 ? ` · ${suspendedCount} suspended` : ''}
            </p>
          </div>
          <button
            onClick={() => team.refetch()}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-semibold text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${team.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {team.isLoading ? (
          <div className="flex justify-center items-center h-32">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : team.error ? (
          <div className="p-6 text-sm text-gray-700">
            Could not load the team: {(team.error as { message?: string }).message || 'unknown error'}
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No admins or role holders found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((m) => {
              const isMe = m.id === meId;
              const style = STATUS_STYLE[m.status];
              return (
                <div key={m.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${style.dot}`}
                      title={style.label}
                      aria-label={style.label}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setFilterUser(filterUser === m.id ? null : m.id)}
                          className="font-semibold text-gray-900 hover:underline truncate text-left"
                          title="Show only this person's activity"
                        >
                          {memberName(m)}
                        </button>
                        {isMe && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">You</span>}
                        {m.status === 'suspended' && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-900 text-white">Suspended</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{m.email}</p>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.roles.length === 0 && <span className="text-xs text-gray-400">No active roles</span>}
                        {m.roles.map((r) => (
                          <span
                            key={r.role_id}
                            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs font-medium"
                          >
                            {r.role_name}
                            {!isMe && (
                              <button
                                onClick={() => setPending({ type: 'role', member: m, roleId: r.role_id, roleName: r.role_name })}
                                className="p-0.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-200"
                                aria-label={`Remove ${r.role_name} from ${memberName(m)}`}
                                title={`Remove ${r.role_name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="lg:w-72 text-sm text-gray-600 space-y-0.5">
                    <p className={m.status === 'online' ? 'text-green-700 font-medium' : ''}>
                      {m.status === 'online' ? (
                        'Online now'
                      ) : m.last_seen ? (
                        <span title={exact(m.last_seen)}>Last seen {ago(m.last_seen)}</span>
                      ) : (
                        'Never seen'
                      )}
                    </p>
                    {m.status === 'online' && m.last_page && <p>Viewing {pageTitle(m.last_page)}</p>}
                    {m.status === 'suspended' && m.suspension && (
                      <p title={exact(m.suspension.blocked_at)}>
                        “{m.suspension.reason}”{m.suspension.blocked_by ? ` · by ${m.suspension.blocked_by}` : ''}
                      </p>
                    )}
                    {m.active_sessions > 0 && (
                      <p className="text-xs text-gray-500">
                        {m.active_sessions} open {m.active_sessions === 1 ? 'session' : 'sessions'}
                      </p>
                    )}
                    {m.last_action && m.last_action_at && (
                      <p className="text-xs text-gray-500 truncate" title={exact(m.last_action_at)}>
                        Last action: {describeActivity({ kind: 'action', action: m.last_action })} · {ago(m.last_action_at)}
                      </p>
                    )}
                  </div>

                  {!isMe && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setPending({ type: 'logout', member: m })}
                        disabled={busy}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                      {m.status === 'suspended' ? (
                        <button
                          onClick={() => setPending({ type: 'restore', member: m })}
                          disabled={busy}
                          className="px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Restore
                        </button>
                      ) : (
                        !m.is_super_admin && (
                          <button
                            onClick={() => setPending({ type: 'suspend', member: m })}
                            disabled={busy}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
                          >
                            <ShieldOff className="h-4 w-4" />
                            Suspend
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100">
        <div className="p-6 border-b border-gray-100 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Live activity
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <span className={`h-2 w-2 rounded-full ${paused ? 'bg-gray-300' : live ? 'bg-green-500' : 'bg-red-500'}`} />
                  {paused ? 'Paused' : live ? 'Live' : 'Reconnecting...'}
                </span>
              </h3>
              <p className="text-sm text-gray-600 mt-1">What the team is doing, newest first. Kept for 90 days.</p>
            </div>
            <button
              onClick={() => (paused ? resume() : setPaused(true))}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-semibold text-sm"
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? `Resume${bufferedCount > 0 ? ` (${bufferedCount} new)` : ''}` : 'Pause live'}
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterUser ?? ''}
              onChange={(e) => setFilterUser(e.target.value || null)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              aria-label="Filter by person"
            >
              <option value="">Everyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberName(m)}
                </option>
              ))}
            </select>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as FeedFilter)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              aria-label="Filter by type"
            >
              <option value="all">Actions and sign-ins</option>
              <option value="actions">Actions only</option>
              <option value="sessions">Sign-ins and sign-outs</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showPageViews}
                onChange={(e) => setShowPageViews(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              Show page views
            </label>
          </div>
        </div>

        {feed.isLoading ? (
          <div className="flex justify-center items-center h-32">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : feed.error ? (
          <div className="p-6 text-sm text-gray-700">
            Could not load activity: {(feed.error as { message?: string }).message || 'unknown error'}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No activity yet for these filters</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <FeedItem key={r.id} row={r} target={r.resource_type === 'user' && r.resource_id ? byId.get(r.resource_id) : undefined} />
            ))}
          </ul>
        )}

        {feed.hasNextPage && (
          <div className="p-4 border-t border-gray-100 text-center">
            <button
              onClick={() => feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold disabled:opacity-50"
            >
              {feed.isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      <ActiveSessionsManager />

      {dialog && (
        <ControlDialog
          open
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirmLabel}
          requireReason={'requireReason' in dialog ? dialog.requireReason : undefined}
          checkboxLabel={'checkboxLabel' in dialog ? dialog.checkboxLabel : undefined}
          pending={busy}
          onConfirm={runControl}
          onClose={() => !busy && setPending(null)}
        />
      )}
    </div>
  );
}

function FeedItem({ row, target }: { row: ActivityRow; target?: TeamMember }) {
  const who = row.actor_name || row.actor_email || 'Someone';
  const details = row.details ?? {};
  const extras =
    row.kind === 'action'
      ? Object.entries(details)
          .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
          .slice(0, 3)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
          .join(' · ')
      : typeof details.reason === 'string' && row.kind === 'access'
        ? `reason: ${details.reason}`
        : '';

  return (
    <li className="px-6 py-3.5 flex items-start gap-4">
      <div className="w-44 flex-shrink-0 text-xs text-gray-500 pt-0.5">
        <p className="text-gray-700 font-medium">{exact(row.created_at)}</p>
        <p>{ago(row.created_at)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900">
          <span className="font-semibold">{who}</span> {describeActivity(row)}
          {target ? <span className="text-gray-600"> — {memberName(target)}</span> : null}
        </p>
        {(extras || row.path) && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {extras}
            {extras && row.path ? ' · ' : ''}
            {row.path}
          </p>
        )}
      </div>
    </li>
  );
}
