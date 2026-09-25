import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { findGameByTitle, getTopRated, getTrending, weightedRating, type GameSummary } from '../api/rawg';
import { getTopDeals, type TopDeal } from '../api/cheapshark';
import { getMostPlayed, type SteamGame } from '../api/steamspy';
import LoadingImage from '../components/LoadingImage';
import { usd } from '../lib/format';

type Tab = 'trending' | 'top' | 'played' | 'deals';

const TABS: { key: Tab; label: string; about: string }[] = [
  { key: 'trending', label: 'Trending', about: 'Released in the last 30 days, most added by RAWG players first.' },
  { key: 'top', label: 'Top rated', about: "The most popular games of the period, ranked by their players' ratings on RAWG." },
  { key: 'played', label: 'Most played', about: 'Most players on Steam at the same time yesterday (estimates by SteamSpy).' },
  { key: 'deals', label: 'Best deals', about: "Today's best PC deals by CheapShark's deal rating: discount, price and reviews together." },
];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => THIS_YEAR - i);
const num = new Intl.NumberFormat('en-GB');

/** Rankings: four lists, each a sub-tab. The tab (and year) live in the address, so Back and links work. */
export default function RankingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'trending') as Tab;
  const yearParam = params.get('year');
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null; // null = all time
  const about = TABS.find((t) => t.key === tab)!.about;

  function go(next: Tab) {
    setParams(next === 'top' && year ? { tab: next, year: String(year) } : { tab: next }, { replace: true });
  }

  return (
    <section className="rankings-page">
      <h1 className="page-title">Rankings</h1>

      <div className="rank-tabs" role="tablist" aria-label="Rankings">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`rank-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => go(t.key)}
            data-testid={`rank-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rank-about">
        <p className="muted small">{about}</p>
        {tab === 'top' && (
          <label className="sort-by">
            <span className="sort-label">Year</span>
            <select
              className="sort-select"
              value={year ?? 'all'}
              onChange={(e) =>
                setParams(e.target.value === 'all' ? { tab: 'top' } : { tab: 'top', year: e.target.value }, { replace: true })
              }
              data-testid="rank-year"
            >
              <option value="all">All time</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        )}
      </div>

      {tab === 'trending' && <RawgList key="trending" load={(s) => getTrending(s)} meta={trendingMeta} />}
      {tab === 'top' && <RawgList key={`top-${year}`} load={(s) => getTopRated(year, s)} meta={topMeta} />}
      {tab === 'played' && <SteamList />}
      {tab === 'deals' && <DealsList />}
    </section>
  );
}

// ---- The lists ----

function useLoad<T>(load: (signal: AbortSignal) => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then(setItems)
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message));
    return () => controller.abort();
  }, []);
  return { items, error };
}

function trendingMeta(g: GameSummary) {
  return <>{g.released ? g.released.slice(0, 4) : 'TBA'}{g.genres?.length ? ` · ${g.genres.slice(0, 2).map((x) => x.name).join(', ')}` : ''}</>;
}

function topMeta(g: GameSummary) {
  return (
    <>
      <span className="rank-score">★ {weightedRating(g).toFixed(2)}</span>
      {' '}· {num.format(g.ratings_count ?? 0)} ratings · {g.released ? g.released.slice(0, 4) : 'TBA'}
    </>
  );
}

function RawgList({ load, meta }: { load: (s: AbortSignal) => Promise<GameSummary[]>; meta: (g: GameSummary) => ReactNode }) {
  const { items, error } = useLoad(load);
  return (
    <ListShell items={items} error={error}>
      {items?.map((g, i) => (
        <RankCard key={g.id} rank={i + 1} title={g.name} image={g.background_image} to={`/game/${g.id}`} meta={meta(g)} />
      ))}
    </ListShell>
  );
}

function SteamList() {
  const { items, error } = useLoad<SteamGame>((s) => getMostPlayed(s));
  return (
    <ListShell items={items} error={error}>
      {items?.map((g, i) => (
        <RankCard
          key={g.appId}
          rank={i + 1}
          title={g.name}
          image={g.image}
          findByName={g.name}
          meta={
            <>
              <span className="rank-score">{num.format(g.peakPlayers)}</span> playing at peak
              {g.positivePercent != null && ` · ${g.positivePercent}% positive`}
            </>
          }
        />
      ))}
    </ListShell>
  );
}

function DealsList() {
  const { items, error } = useLoad<TopDeal>((s) => getTopDeals(s));
  return (
    <ListShell items={items} error={error}>
      {items?.map((d, i) => (
        <RankCard
          key={d.title + i}
          rank={i + 1}
          title={d.title}
          image={d.image}
          findByName={d.title}
          corner={<span className="rank-discount">-{d.savingsPercent}%</span>}
          meta={
            <>
              <span className="rank-score">{d.price === 0 ? 'Free' : usd.format(d.price)}</span>
              {d.normalPrice > d.price && <s className="deal-retail"> {usd.format(d.normalPrice)}</s>} at {d.storeName}
            </>
          }
        />
      ))}
    </ListShell>
  );
}

function ListShell({ items, error, children }: { items: unknown[] | null; error: string; children: ReactNode }) {
  if (error) return <p className="status error" data-testid="rank-error">{error}</p>;
  if (!items) {
    return (
      <div className="grid" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card card-skeleton" aria-hidden>
            <div className="card-image skeleton" />
            <div className="card-body"><span className="sk-line" style={{ width: '80%' }} /><span className="sk-line" style={{ width: '40%' }} /></div>
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) return <p className="status">Nothing to show right now.</p>;
  return <div className="grid" data-testid="rank-list">{children}</div>;
}

// ---- One numbered card ----

interface CardProps {
  rank: number;
  title: string;
  image: string | null;
  meta: ReactNode;
  corner?: ReactNode;
  /** A game page we already know (RAWG lists). */
  to?: string;
  /** Otherwise (Steam, deals): find the game on RAWG by name when clicked, or fall back to a search. */
  findByName?: string;
}

function RankCard({ rank, title, image, meta, corner, to, findByName }: CardProps) {
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  const body = (
    <>
      <div className="card-image">
        {image ? <LoadingImage src={image} alt={title} /> : <div className="card-image-empty">No image</div>}
        <span className={`rank-number ${rank <= 3 ? 'podium' : ''}`} aria-label={`Number ${rank}`}>{rank}</span>
        {corner}
      </div>
      <div className="card-body">
        <h3 className="card-title" data-testid="rank-card-title">{title}</h3>
        <p className="card-meta">{opening ? 'Opening…' : meta}</p>
      </div>
    </>
  );

  if (to) return <Link to={to} className="card" data-testid="rank-card">{body}</Link>;

  async function open() {
    if (opening || !findByName) return;
    setOpening(true);
    const game = await findGameByTitle(findByName, null).catch(() => null);
    navigate(game ? `/game/${game.id}` : `/?q=${encodeURIComponent(findByName)}`);
  }

  return (
    <button type="button" className="card rank-card-button" onClick={open} disabled={opening} data-testid="rank-card">
      {body}
    </button>
  );
}
