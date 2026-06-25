const masterEmails = new Set(["foxsun2@naver.com"]);

export function getAccountRole(email?: string | null) {
  if (!email) return "user";
  return masterEmails.has(email.trim().toLowerCase()) ? "master" : "user";
}
