import { useEffect, useRef, useState } from 'react';
import { Ban, ChevronDown, ShieldCheck, Trash2 } from 'lucide-react';
import { useUserRestriction } from '@/hooks/queries/useUsersData';
import PostNoDebitDialog from '@/components/PostNoDebitDialog';
import DeleteUserDialog from '@/components/DeleteUserDialog';

type UserActionsMenuProps = {
  userId: string;
  userName?: string;
  canRestrict: boolean;
  canDelete: boolean;
};

export default function UserActionsMenu({ userId, userName, canRestrict, canDelete }: UserActionsMenuProps) {
  const { data: restriction } = useUserRestriction(userId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pndOpen, setPndOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (!canRestrict && !canDelete) return null;

  const isRestricted = restriction?.post_no_debit === true;

  const choose = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <>
      <div ref={wrapperRef} className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-900 font-medium hover:bg-gray-50 shadow-soft transition-all"
        >
          <span>Actions</span>
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-large border border-gray-100 py-1 z-50"
          >
            {canRestrict && (
              <button
                role="menuitem"
                onClick={() => choose(() => setPndOpen(true))}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="mt-0.5 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  {isRestricted ? (
                    <ShieldCheck className="h-4 w-4 text-gray-700" />
                  ) : (
                    <Ban className="h-4 w-4 text-gray-700" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium text-gray-900">
                    {isRestricted ? 'Remove Post No Debit' : 'Post No Debit'}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {isRestricted
                      ? 'Allow new payout plans and locking funds again'
                      : 'Block new payout plans and locking funds'}
                  </span>
                </span>
              </button>
            )}

            {canRestrict && canDelete && <div className="my-1 border-t border-gray-100" />}

            {canDelete && (
              <button
                role="menuitem"
                onClick={() => choose(() => setDeleteOpen(true))}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="mt-0.5 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="h-4 w-4 text-error" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-error">Delete user</span>
                  <span className="block text-xs text-gray-500">
                    Permanently remove a user with no active plans or vaults
                  </span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {canRestrict && (
        <PostNoDebitDialog userId={userId} userName={userName} open={pndOpen} onClose={() => setPndOpen(false)} />
      )}
      {canDelete && (
        <DeleteUserDialog userId={userId} userName={userName} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
      )}
    </>
  );
}
