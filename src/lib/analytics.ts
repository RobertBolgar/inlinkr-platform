// Lightweight analytics utility for billing funnel events
// Disabled for launch - no console logging

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: string;
}

class Analytics {
  private isEnabled: boolean;

  constructor() {
    // Disabled for launch
    this.isEnabled = false;
  }

  track(_event: string, _properties?: Record<string, any>) {
    if (!this.isEnabled) return;

    // TODO: Send to real analytics service when enabled
    // Example: sendToAnalyticsService({ event: _event, properties: _properties, timestamp: new Date().toISOString() });
  }

  // Billing funnel specific events
  trackUpgradeStarted(plan: string, source: string = 'unknown') {
    this.track('upgrade_started', {
      plan,
      source,
    });
  }

  trackCheckoutOpened(plan: string, billingInterval: string) {
    this.track('checkout_opened', {
      plan,
      billingInterval,
    });
  }

  trackCheckoutReturned(plan?: string) {
    this.track('checkout_returned', {
      plan,
    });
  }

  trackPortalOpened(source: string = 'unknown') {
    this.track('portal_opened', {
      source,
    });
  }
}

export const analytics = new Analytics();
