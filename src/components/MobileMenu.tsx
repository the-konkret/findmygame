import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useLogOut } from '../auth/useLogOut';
import { CloseIcon, CogIcon, GiftIcon, MenuIcon, NewsIcon, StarIcon, TagIcon, TrophyIcon, UserIcon, LogOutIcon } from './Icons';

/**
 * Phones: the ☰ button in the top bar, with every page link in a panel under the bar
 * (the notification bell stays in the bar). Closes on a link tap, Esc, or a tap outside.
 */
export default function MobileMenu() {
  const { user } = useAuth();
  const logOut = useLogOut();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  // While the menu covers the screen, the page behind it shouldn't scroll.
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, [open]);

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

  const item = (to: string, icon: ReactNode, label: string, testId: string) => (
    <NavLink to={to} className="mobile-menu-item" onClick={() => setOpen(false)} data-testid={testId}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );

  return (
    <div className="mobile-menu" ref={wrapRef}>
      <button
        type="button"
        className={`nav-icon nav-burger ${open ? 'active' : ''}`}
        aria-label={open ? 'Close menu' : 'Menu'}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        onClick={() => setOpen((o) => !o)}
        data-testid="nav-burger"
      >
        {open ? <CloseIcon size={18} /> : <MenuIcon />}
      </button>

      {/* Always there, slid off to the right while closed, so it can slide in and out */}
      <nav
        id="mobile-menu-panel"
        className={`mobile-menu-panel ${open ? 'open' : ''}`}
        aria-label="Menu"
        aria-hidden={!open}
        inert={!open}
        data-testid="mobile-menu"
      >
          {item('/rankings', <TrophyIcon size={18} />, 'Rankings', 'mm-rankings')}
          {item('/news', <NewsIcon size={18} />, 'News', 'mm-news')}
          {user ? (
            <>
              {item('/favourites', <StarIcon size={18} />, 'My favourites', 'mm-favourites')}
              {item('/wishlist', <GiftIcon size={18} />, 'Wishlist', 'mm-wishlist')}
              {item('/alerts', <TagIcon size={18} />, 'Alerts', 'mm-alerts')}
              <div className="mobile-menu-sep" />
              {item('/account', <CogIcon size={18} />, 'Settings', 'mm-settings')}
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => {
                  setOpen(false);
                  logOut();
                }}
                data-testid="mm-logout"
              >
                <LogOutIcon />
                <span>Log out</span>
              </button>
            </>
          ) : (
            <>
              <div className="mobile-menu-sep" />
              {item('/login', <UserIcon />, 'Log in', 'mm-login')}
            </>
          )}
      </nav>
    </div>
  );
}
