import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="surface-panel flex max-w-md flex-col items-center gap-6 p-10 text-center">
        <p className="wordmark text-muted-foreground">Error</p>
        <h1 className="text-6xl font-semibold tracking-tight text-foreground">404</h1>
        <p className="text-scale-sm text-muted-foreground">This page doesn’t exist or was moved.</p>
        <Link
          to="/"
          className="flex min-h-11 items-center gap-2 rounded-2xl gradient-brand px-6 py-3 text-sm font-semibold text-primary-foreground shadow-fab touch-press"
        >
          <Home className="h-4 w-4" strokeWidth={2} />
          Back home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
