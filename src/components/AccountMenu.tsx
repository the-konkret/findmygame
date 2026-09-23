import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLogOut } from '../auth/useLogOut';

/**
 * The cog / profile picture in the top bar, with a small menu: Settings and Log out.
 *  - With a mouse: the menu opens when you point at it; clicking the icon goes straight to Settings.
 *  - On phones and with the keyboard: tap / Enter opens and closes it.
 *  - Esc, or a tap anywhere else, closes it.
 */
export default function AccountMenu({ icon, isAvatar }: { icon: ReactNode; isAvatar: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const lastPointer = useRef<string>('');
  const logOut = useLogOut();
  const { pathname } = useLocation();

  // Close when moving to another page.
  useEffect(() => setOpen(false), [pathname]);

  // Close on a tap/click outside, or Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Hover (mouse only; touch screens fake "hover" on tap, which would fight with the tap toggle).
  const onEnter = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const onLeave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    // a short delay so moving the mouse from the icon down into the menu doesn't close it
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  };

  return (
    <div className="account-menu" ref={wrapRef} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <Link
        to="/account"
        className={`nav-icon ${isAvatar ? 'nav-avatar' : 'nav-cog'} ${open || pathname === '/account' ? 'active' : ''}`}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="nav-account"
        onPointerDown={(e) => (lastPointer.current = e.pointerType)}
        onClick={(e) => {
          // Mouse: the menu is already open from hovering, so a click goes to Settings.
          // Touch or keyboard: open / close the menu instead.
          if (lastPointer.current !== 'mouse') {
            e.preventDefault();
            setOpen((o) => !o);
          }
          lastPointer.current = '';
        }}
      >
        {icon}
      </Link>

      {open && (
        <div className="account-dropdown" role="menu" data-testid="account-menu">
          <Link to="/account" role="menuitem" className="account-item" data-testid="menu-settings">
            Settings
          </Link>
          <button type="button" role="menuitem" className="account-item" onClick={logOut} data-testid="menu-logout">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
