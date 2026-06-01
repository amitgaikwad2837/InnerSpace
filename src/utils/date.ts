export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getStreakDays(completionDates: Date[]): number {
  const sortedDates = completionDates
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 0;
  const today = new Date();
  let checkDate = new Date(today);

  for (const date of sortedDates) {
    const isConsecutive =
      Math.abs(checkDate.getTime() - date.getTime()) < 24 * 60 * 60 * 1000;
    if (isConsecutive) {
      streak++;
      checkDate = new Date(date);
    } else {
      break;
    }
  }

  return streak;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
