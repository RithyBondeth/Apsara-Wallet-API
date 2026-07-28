/**
 * Builders for the notifications the app emits from real events. Each returns
 * the persisted shape: a machine `type` + `data` params (so bilingual clients
 * localize the copy themselves) plus an English `title`/`body` fallback and an
 * icon token + hex color.
 */
export interface EmitNotification {
  type: string;
  data: Record<string, unknown>;
  title: string;
  body: string;
  icon: string;
  color: string;
}

export const NotificationTemplates = {
  recurringPosted(count: number): EmitNotification {
    return {
      type: 'recurring_posted',
      data: { count },
      title: 'Recurring entries posted',
      body:
        count === 1
          ? '1 recurring entry was added to your ledger.'
          : `${count} recurring entries were added to your ledger.`,
      icon: 'repeat',
      color: '#27A79A',
    };
  },

  savingsMilestone(name: string, pct: 50 | 100): EmitNotification {
    const reached = pct === 100;
    return {
      type: 'savings_milestone',
      data: { name, pct },
      title: reached ? 'Goal reached! 🎉' : 'Halfway there',
      body: reached
        ? `You hit your "${name}" savings goal.`
        : `"${name}" is halfway to its target.`,
      icon: 'piggyBank',
      color: '#2E9E68',
    };
  },

  budgetAlert(category: string): EmitNotification {
    return {
      type: 'budget_alert',
      data: { category },
      title: 'Budget alert',
      body: `You've reached your ${category} budget for this month.`,
      icon: 'chartPie',
      color: '#E8A33D',
    };
  },
};
