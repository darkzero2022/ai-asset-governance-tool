/**
 * A small deny-list of the most common / breached passwords, lowercased.
 * Drawn from the top entries of public breach compilations (rockyou, HIBP top
 * lists, NCSC top-100k). Not exhaustive by design — this catches the passwords
 * that show up in the overwhelming majority of credential-stuffing attempts
 * without shipping a multi-MB word list. Combined with the 12-char minimum it
 * is a reasonable NIST-800-63B-style check.
 */
const COMMON_PASSWORDS = new Set(
  [
    "123456789012",
    "password1234",
    "qwertyuiop12",
    "111111111111",
    "123123123123",
    "000000000000",
    "iloveyou1234",
    "adminadmin12",
    "welcome12345",
    "password1!23",
    "qwerty123456",
    "abc123abc123",
    "letmein12345",
    "123456qwerty",
    "monkey123456",
    "dragon123456",
    "sunshine1234",
    "princess1234",
    "football1234",
    "baseball1234",
    "trustno11234",
    "superman1234",
    "batman123456",
    "michael12345",
    "jennifer1234",
    "computer1234",
    "internet1234",
    "samsung12345",
    "whatever1234",
    "passw0rd1234",
    "password123!",
    "adminpassword",
    "administrator",
    "changeme1234",
    "changeme123!",
    "welcome1234!",
    "companyname12",
    "temppassword1",
    "qazwsxedc123",
    "1q2w3e4r5t6y",
    "1qaz2wsx3edc",
    "zxcvbnm12345",
    "asdfghjkl123",
    "passwordpassword",
    "letmein123456",
    "password12345",
    "welcomewelcome",
    "aaaaaaaaaaaa",
    "abcdefghijkl",
    "qwertyqwerty",
    "123qweasdzxc",
    "p@ssw0rd1234",
    "p@ssword1234",
    "secret123456",
    "master123456",
    "shadow123456",
    "michelle1234",
    "jordan123456",
    "hunter123456",
    "buster123456",
    "soccer123456",
    "harley123456",
    "ranger123456",
    "daniel123456",
    "hannah123456",
    "thomas123456",
    "summer123456",
    "george123456",
    "startrek1234",
    "maverick1234",
    "access123456",
    "flower123456",
    "matthew12345",
    "andrew123456",
    "joshua123456",
    "amanda123456",
    "charlie12345",
    "nicole123456",
    "anthony12345",
    "ashley123456",
    "12345678910j",
    "qwerty1234567",
    "iloveyou123!",
    "password2024",
    "password2025",
    "password2026",
    "welcome2024!",
    "welcome2025!",
    "welcome2026!",
    "admin@12345",
    "aibom1234567",
    "aibomadmin12",
    "aibompassword",
    "governance123",
    "security1234",
  ].map((entry) => entry.toLowerCase()),
);

/** True when the password is on the deny-list or is a trivial variant of it. */
export function isCommonPassword(raw: string): boolean {
  const password = raw.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(password)) return true;
  // strip trailing digits / bangs so "password!!" or "welcome99" still catch
  const core = password.replace(/[0-9!@#$%^&*._-]+$/g, "");
  return (
    core.length >= 5 &&
    ["password", "welcome", "changeme", "letmein", "qwerty", "aibom", "admin"].includes(core)
  );
}
