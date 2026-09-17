import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-terracotta-50 text-terracotta-600 mb-6">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="font-serif text-4xl font-medium tracking-tight text-sand-950 sm:text-5xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-sand-600">
        It seems you&apos;ve wandered off the trail. The page or journey you are looking for does
        not exist or may have been moved.
      </p>
      <div className="mt-8">
        <Link to="/trips">
          <Button variant="primary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Return to Journeys
          </Button>
        </Link>
      </div>
    </div>
  );
}
