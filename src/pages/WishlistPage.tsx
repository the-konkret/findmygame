import { Link } from 'react-router-dom';
import GameListPage from './GameListPage';

export default function WishlistPage() {
  return (
    <GameListPage
      list="wishlist"
      title="Wishlist"
      path="/wishlist"
      testId="wishlist"
      empty={<>Your wishlist is empty. <Link to="/">Search for a game</Link> and click “Add to wishlist”.</>}
    />
  );
}
