import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '../lib/auth/clerk';
import { useAuth as useAppAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';

const VALID_PLANS = ['pro_yearly', 'pro_monthly', 'founder'] as const;

export function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getToken } = useClerkAuth();
  const { user, loading } = useAppAuth();
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  const rawPlan = searchParams.get('plan');
  const isValidPlan = rawPlan !== null && (VALID_PLANS as readonly string[]).includes(rawPlan);

  useEffect(() => {
    if (!isValidPlan) {
      navigate('/pricing', { replace: true });
      return;
    }

    if (loading || !user || started) return;

    setStarted(true);

    const startCheckout = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setError('Authentication failed. Please log in again.');
          return;
        }

        let body: { plan: string; billingInterval?: string };
        if (rawPlan === 'pro_yearly') {
          body = { plan: 'pro', billingInterval: 'yearly' };
        } else if (rawPlan === 'pro_monthly') {
          body = { plan: 'pro', billingInterval: 'monthly' };
        } else {
          body = { plan: 'founder' };
        }

        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create checkout session');
        }

        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL returned');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to start checkout. Please try again.');
      }
    };

    startCheckout();
  }, [user, loading, isValidPlan, started]);

  if (!isValidPlan) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/pricing')}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            ← Back to pricing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-sm">Setting up checkout…</div>
    </div>
  );
}
