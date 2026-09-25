import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSiteStats, type SiteStats } from '../api/analytics';

// Chart colours (checked for colour-blind readers against the dark background):
const IN_COLOR = '#e8650a'; // logged-in users: the site's orange
const OUT_COLOR = '#5b8fd6'; // logged-out visitors: blue

const RANGES: { key: keyof SiteStats['totals']; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

const dayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const num = new Intl.NumberFormat('en-GB');

/** Visit statistics. Not linked from anywhere: open /stats directly. Shows totals only, never who visited. */
export default function StatsPage() {
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getSiteStats(30).then(setStats).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section className="stats-page">
      <h1 className="page-title">Statistics</h1>
      {error && <p className="status error" data-testid="stats-error">{error}</p>}
      {!stats && !error && <p className="status">Loading…</p>}

      {stats && (
        <>
          <div className="stat-tiles" data-testid="stat-tiles">
            {RANGES.map(({ key, label }) => {
              const t = stats.totals[key];
              return (
                <div key={key} className="panel stat-tile">
                  <span className="stat-label">{label}</span>
                  <span className="stat-number">{num.format(t.visitors)}</span>
                  <span className="stat-unit">{t.visitors === 1 ? 'visitor' : 'visitors'}</span>
                  <span className="stat-split">
                    <span className="stat-key" style={{ background: IN_COLOR }} />
                    {num.format(t.logged_in_users)} logged in
                  </span>
                  <span className="stat-split">
                    <span className="stat-key" style={{ background: OUT_COLOR }} />
                    {num.format(t.logged_out_visitors)} logged out
                  </span>
                  <span className="stat-views">{num.format(t.views)} page views</span>
                </div>
              );
            })}
            <div className="panel stat-tile">
              <span className="stat-label">Accounts</span>
              <span className="stat-number">{num.format(stats.accounts)}</span>
              <span className="stat-unit">registered</span>
            </div>
          </div>

          <DailyChart daily={stats.daily} />

          <div className="panel stats-section">
            <h2>Most visited pages (last 30 days)</h2>
            {stats.pages.length === 0 ? (
              <p className="muted">No visits yet.</p>
            ) : (
              <table className="stats-table" data-testid="stats-pages">
                <thead>
                  <tr><th>Page</th><th className="num">Views</th><th className="num">Visitors</th></tr>
                </thead>
                <tbody>
                  {stats.pages.map((p) => (
                    <tr key={p.path}>
                      <td><Link to={p.path}>{p.path}</Link></td>
                      <td className="num">{num.format(p.views)}</td>
                      <td className="num">{num.format(p.visitors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="muted small stats-foot">
            A visitor is one browser. Logged-in users are counted by account; someone who logs in during a visit
            counts in both. Days are in Polish time. Visits from your own computer (npm run dev) aren't counted.
          </p>
        </>
      )}
    </section>
  );
}

/** Stacked bars: logged-in users and logged-out visitors per day. Hover (or Tab to) a day for its numbers. */
function DailyChart({ daily }: { daily: SiteStats['daily'] }) {
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(1, ...daily.map((d) => d.logged_in + d.logged_out)));
  const ticks = [top, top / 2, 0];

  return (
    <div className="panel stats-section">
      <div className="stats-chart-head">
        <h2>Visitors per day (last 30 days)</h2>
        <div className="chart-legend">
          <span><span className="stat-key" style={{ background: IN_COLOR }} /> Logged in</span>
          <span><span className="stat-key" style={{ background: OUT_COLOR }} /> Logged out</span>
          <button type="button" className="btn-ghost chart-toggle" onClick={() => setAsTable((t) => !t)}>
            {asTable ? 'Show chart' : 'Show table'}
          </button>
        </div>
      </div>

      {asTable ? (
        <table className="stats-table">
          <thead>
            <tr><th>Day</th><th className="num">Logged in</th><th className="num">Logged out</th><th className="num">Page views</th></tr>
          </thead>
          <tbody>
            {[...daily].reverse().map((d) => (
              <tr key={d.day}>
                <td>{weekday.format(new Date(d.day))}</td>
                <td className="num">{d.logged_in}</td>
                <td className="num">{d.logged_out}</td>
                <td className="num">{d.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="chart" data-testid="stats-chart">
          <div className="chart-y">
            {ticks.map((t) => <span key={t} style={{ top: `${(1 - t / top) * 100}%` }}>{t}</span>)}
          </div>
          <div className="chart-plot">
            <div className="chart-grid">
              {ticks.map((t) => <span key={t} />)}
            </div>
            <div className="chart-bars" onMouseLeave={() => setHover(null)}>
              {daily.map((d, i) => {
                const total = d.logged_in + d.logged_out;
                return (
                  <div
                    key={d.day}
                    className={`chart-col ${hover === i ? 'hover' : ''}`}
                    tabIndex={0}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${weekday.format(new Date(d.day))}: ${d.logged_in} logged in, ${d.logged_out} logged out, ${d.views} page views`}
                  >
                    <div className="chart-stack" style={{ height: `${(total / top) * 100}%` }}>
                      {d.logged_in > 0 && <span style={{ flexGrow: d.logged_in, background: IN_COLOR }} />}
                      {d.logged_out > 0 && <span style={{ flexGrow: d.logged_out, background: OUT_COLOR }} />}
                    </div>
                    {hover === i && (
                      <div
                        className={`chart-tip ${i > daily.length - 6 ? 'left' : ''}`}
                        role="tooltip"
                        style={{ bottom: `calc(${(total / top) * 100}% + 8px)` }}
                      >
                        <strong>{weekday.format(new Date(d.day))}</strong>
                        <span><span className="stat-key" style={{ background: IN_COLOR }} /> {d.logged_in} logged in</span>
                        <span><span className="stat-key" style={{ background: OUT_COLOR }} /> {d.logged_out} logged out</span>
                        <span className="muted">{d.views} page views</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="chart-x">
              {daily.map((d, i) => (
                <span key={d.day}>{i % 7 === daily.length % 7 || i === daily.length - 1 ? dayLabel.format(new Date(d.day)) : ''}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A round number just above the highest bar, for the chart's scale (…, 20, 30, 40, 50, 60, 80, 100, …). */
function niceMax(n: number): number {
  const step = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 3, 4, 5, 6, 8, 10]) if (m * step >= n) return m * step;
  return 10 * step;
}
