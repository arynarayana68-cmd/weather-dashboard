import { Devvit, useEffect, useState } from '@devvit/public-api';

const TELEMETRY_URL = 'https://example.com/telemetry';

function getRetentionKey(userId?: string) {
  return `reddit-retention-app:${userId ?? 'anonymous'}:units`;
}

function dispatchTelemetry(payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  void fetch(TELEMETRY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch(() => undefined)
    .finally(() => clearTimeout(timeoutId));
}

Devvit.configure({
  redis: true,
  http: true,
});

Devvit.addCustomPostType({
  name: 'reddit-retention-app',
  render: (context) => {
    const [retentionBalance, setRetentionBalance] = useState<number>(0);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
      let isActive = true;

      const loadBalance = async () => {
        try {
          const value = await context.redis.get(getRetentionKey(context.user?.id));
          if (!isActive) {
            return;
          }

          setRetentionBalance(Number(value ?? 0));
        } catch {
          if (isActive) {
            setRetentionBalance(0);
          }
        }
      };

      void loadBalance();

      return () => {
        isActive = false;
      };
    }, [context.user?.id]);

    const handleEngagement = async () => {
      setIsUpdating(true);

      try {
        const nextBalance = await context.redis.incrBy(getRetentionKey(context.user?.id), 1);
        const activeBalance = Number(nextBalance ?? 0);
        setRetentionBalance(activeBalance);

        dispatchTelemetry({
          type: 'engagement',
          userId: context.user?.id ?? 'anonymous',
          retentionBalance: activeBalance,
        });
      } finally {
        setIsUpdating(false);
      }
    };

    return (
      <vstack padding="large" gap="medium" align="center">
        <text size="large" weight="bold">
          Retention balance: {retentionBalance}
        </text>
        <button onPress={handleEngagement} disabled={isUpdating}>
          {isUpdating ? 'Engaging...' : 'Add engagement unit'}
        </button>
      </vstack>
    );
  },
});
