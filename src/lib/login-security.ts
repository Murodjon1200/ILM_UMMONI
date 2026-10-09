import { db } from "@/lib/db";

export const failedLoginPolicy = {
  blockDurationMs: 15 * 60 * 1000,
  /** failures for the same account from the same address */
  maxFailuresPerAccountAndIp: 5,
  /** failures for one account from any address, including rotating ones */
  maxFailuresPerAccount: 25,
};

function getWindowStart() {
  return new Date(Date.now() - failedLoginPolicy.blockDurationMs);
}

export async function isLoginBlocked(ip: string, email: string) {
  const window = { gte: getWindowStart() };

  const [perAccountAndIp, perAccount] = await Promise.all([
    db.loginAttempt.count({
      where: { success: false, createdAt: window, ip, email },
    }),
    db.loginAttempt.count({
      where: { success: false, createdAt: window, email },
    }),
  ]);

  // A single (account, ip) threshold plus a much higher account-wide threshold.
  // The account-wide limit still catches distributed credential stuffing, but
  // the higher bar means an attacker cannot lock a known account out with five
  // requests from one address.
  return (
    perAccountAndIp >= failedLoginPolicy.maxFailuresPerAccountAndIp ||
    perAccount >= failedLoginPolicy.maxFailuresPerAccount
  );
}

export async function recordFailedLogin(ip: string, email: string) {
  await db.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  await db.loginAttempt.create({
    data: {
      ip,
      email,
      success: false,
    },
  });
}

export async function clearFailedLoginAttempts(ip: string, email: string) {
  await db.loginAttempt.deleteMany({
    where: {
      OR: [{ ip, email }, { email }],
      success: false,
    },
  });
}
