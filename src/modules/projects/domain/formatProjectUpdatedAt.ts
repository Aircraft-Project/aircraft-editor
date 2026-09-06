const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const formatTime = (date: Date): string =>
  new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

export const formatProjectUpdatedAt = (
  updatedAt: string,
  now: Date = new Date(),
): string => {
  const updatedDate = new Date(updatedAt);

  if (Number.isNaN(updatedDate.getTime())) {
    return "Editado: fecha desconocida";
  }

  const differenceInMilliseconds =
    startOfLocalDay(now).getTime() -
    startOfLocalDay(updatedDate).getTime();
  const differenceInDays = Math.max(
    0,
    Math.round(differenceInMilliseconds / 86_400_000),
  );

  if (differenceInDays === 0) {
    return `Editado: hoy, ${formatTime(updatedDate)}`;
  }

  if (differenceInDays === 1) {
    return "Editado: ayer";
  }

  return `Editado: hace ${differenceInDays} días`;
};
