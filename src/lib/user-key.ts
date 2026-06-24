export function getOrCreateUserKey() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem("lime-user-key");
  if (existing) return existing;

  const next = crypto.randomUUID();
  window.localStorage.setItem("lime-user-key", next);
  return next;
}
