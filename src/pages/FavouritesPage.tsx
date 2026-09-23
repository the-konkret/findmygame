import { Link } from 'react-router-dom';
import GameListPage from './GameListPage';

export default function FavouritesPage() {
  return (
    <GameListPage
      list="favourites"
      title="My favourites"
      path="/favourites"
      testId="favourite"
      empty={<>No favourites yet. <Link to="/">Search for a game</Link> and click the ☆ in the corner of its picture.</>}
    />
  );
}
