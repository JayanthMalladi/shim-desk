import { useEffect, useState } from 'react';
import { RunsPage } from './pages/RunsPage';
import { RunPage } from './pages/RunPage';

// Hash router (02 §2): no router dependency. #/ -> RunsPage,
// #/run/<runId> -> RunPage, anything else -> NotFound.

function parseHash(): { page: 'runs' } | { page: 'run'; runId: string } | { page: 'notFound' } {
  const hash = window.location.hash;
  if (hash === '#/' || hash === '#' || hash === '') return { page: 'runs' };
  const m = hash.match(/^#\/run\/([^/]+)$/);
  if (m) return { page: 'run', runId: decodeURIComponent(m[1]) };
  return { page: 'notFound' };
}

export function App() {
  const [route, setRoute] = useState(parseHash());

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  switch (route.page) {
    case 'run':
      return <RunPage runId={route.runId} />;
    case 'runs':
      return <RunsPage />;
    default:
      return <NotFound />;
  }
}

function NotFound() {
  return (
    <main style={{ padding: '48px 16px', fontFamily: 'system-ui' }}>
      <h1>Not found</h1>
      <p>
        No such page. <a href="#/">Back to all runs</a>.
      </p>
    </main>
  );
}
