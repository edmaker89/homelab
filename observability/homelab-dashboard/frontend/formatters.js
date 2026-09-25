export const numeric = (value) =>
  typeof value === "number" && Number.isFinite(value);
export const value = (x) =>
  x == null || x === ""
    ? "Não informado"
    : typeof x === "object"
      ? JSON.stringify(x)
      : String(x);
export const number = (x) =>
  numeric(x) ? x.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";
export const percent = (x) => (numeric(x) ? `${number(x)}%` : "—");
export const temperature = (x) => (numeric(x) ? `${number(x)} °C` : "—");
export function bytes(x) {
  if (!numeric(x) || x < 0) return "—";
  const unit = x >= 1024 ** 3 ? 3 : x >= 1024 ** 2 ? 2 : x >= 1024 ? 1 : 0;
  return `${number(x / 1024 ** unit)} ${["B", "KiB", "MiB", "GiB"][unit]}`;
}
export function uptime(x) {
  if (!numeric(x) || x < 0) return "—";
  const minutes = Math.floor(x / 60);
  return `${minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ` : ""}${Math.floor(minutes / 60) % 24}h ${minutes % 60}m`;
}
export function freshness(date, now = Date.now(), limit = 300) {
  const time = typeof date === "string" ? Date.parse(date) : NaN;
  if (!Number.isFinite(time))
    return { stale: true, text: "Data de atualização não informada" };
  const age = Math.floor((now - time) / 1000);
  if (age < -60)
    return {
      stale: true,
      text: "Timestamp no futuro; confira o relógio da fonte",
    };
  return {
    stale: age > limit,
    text: `${age > limit ? "Dados possivelmente desatualizados · " : ""}Atualizado há ${age < 60 ? `${Math.max(0, age)} s` : uptime(age)}`,
  };
}
export const timestamp = (date) =>
  typeof date === "string" && Number.isFinite(Date.parse(date))
    ? new Date(date).toLocaleString("pt-BR")
    : "Não informado";
