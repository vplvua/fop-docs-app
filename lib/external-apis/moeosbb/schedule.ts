export function shouldRunSync(schedule: string, today: Date): boolean {
  if (schedule === "manual") return false;

  const day = today.getDate();

  if (schedule === "first") return day === 1;

  if (schedule === "last") {
    const nextDay = new Date(today.getFullYear(), today.getMonth(), day + 1);
    return nextDay.getDate() === 1;
  }

  return false;
}
