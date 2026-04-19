export interface User {
  id: string;
  email: string;
  email_domain: string;
  stripe_customer_id: string | null;
  api_key: string | null;
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
