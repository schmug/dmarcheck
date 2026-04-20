export interface User {
  id: string;
  email: string;
  email_domain: string;
  stripe_customer_id: string | null;
  api_key: string | null;
  email_alerts_enabled: number;
  created_at: number;
}

export async function createUser(
  db: D1Database,
  input: { id: string; email: string },
): Promise<void> {
  const emailDomain = input.email.split("@")[1];
  await db
    .prepare("INSERT INTO users (id, email, email_domain) VALUES (?, ?, ?)")
    .bind(input.id, input.email, emailDomain)
    .run();
}

export async function getUserById(
  db: D1Database,
  id: string,
): Promise<User | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<User>();
}

export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<User | null> {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<User>();
}

export async function getUserByApiKey(
  db: D1Database,
  apiKey: string,
): Promise<User | null> {
  return db
    .prepare("SELECT * FROM users WHERE api_key = ?")
    .bind(apiKey)
    .first<User>();
}

export async function setApiKey(
  db: D1Database,
  userId: string,
  apiKey: string,
): Promise<void> {
  await db
    .prepare("UPDATE users SET api_key = ? WHERE id = ?")
    .bind(apiKey, userId)
    .run();
}

export async function getUserByStripeCustomerId(
  db: D1Database,
  stripeCustomerId: string,
): Promise<User | null> {
  return db
    .prepare("SELECT * FROM users WHERE stripe_customer_id = ?")
    .bind(stripeCustomerId)
    .first<User>();
}

export async function setStripeCustomerId(
  db: D1Database,
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await db
    .prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?")
    .bind(stripeCustomerId, userId)
    .run();
}

export async function setEmailAlertsEnabled(
  db: D1Database,
  userId: string,
  enabled: boolean,
): Promise<void> {
  await db
    .prepare("UPDATE users SET email_alerts_enabled = ? WHERE id = ?")
    .bind(enabled ? 1 : 0, userId)
    .run();
}
