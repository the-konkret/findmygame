/** Credit line under news lists: Valve's API terms ask for a link to Steam, and we must not look endorsed. */
export default function NewsCredit() {
  return (
    <p className="muted small news-credit">
      Posts by the games' developers and publishers, via{' '}
      <a href="https://store.steampowered.com/" target="_blank" rel="noreferrer">Steam</a>. Not affiliated with Valve.
    </p>
  );
}
