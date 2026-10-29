type AuthErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
};

export function authErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;

  const details = error as AuthErrorLike;
  const code = typeof details.code === "string" ? details.code : "";
  const status = typeof details.status === "number" ? details.status : undefined;
  const message = typeof details.message === "string" && details.message.trim() !== "{}"
    ? details.message.trim()
    : "";

  if (code === "email_address_not_authorized") {
    return "Supabase’s built-in mailer only sends to project team addresses. Check custom SMTP settings or test with an authorized team address.";
  }

  if (code === "over_email_send_rate_limit" || status === 429) {
    return "Supabase’s email sending limit was reached. Wait before trying again, or check the configured SMTP provider’s limits.";
  }

  if (status && status >= 500) {
    return `Supabase could not send the email (HTTP ${status}${code ? `, ${code}` : ""}). Check Authentication → Logs for the SMTP error.`;
  }

  const context = [code, status ? `HTTP ${status}` : ""].filter(Boolean).join(", ");
  if (message) return context ? `${message} (${context})` : message;
  return context ? `The email request failed (${context}). Check Authentication → Logs for details.` : fallback;
}
