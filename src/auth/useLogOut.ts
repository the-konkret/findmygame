import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/**
 * Log out and land on the home page.
 * Go home FIRST, then log out: otherwise a page that needs a login (like Account) notices you're logged
 * out, sends you to the log-in page and remembers to bring you back there after the next log-in.
 */
export function useLogOut(): () => Promise<void> {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  return async () => {
    navigate('/', { replace: true });
    await signOut();
  };
}
