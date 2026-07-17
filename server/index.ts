import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAllSitters, getSitterById, query, run } from "./db";
import {
  createUser,
  loginUser,
  verifyToken,
  generateId,
  getUserById,
} from "./auth";
import type { UserPayload } from "./auth";

const app = new Hono();
app.use("/*", cors());

// ── Auth middleware ──
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  c.set("user", payload);
  await next();
};

function getUser(c: any): UserPayload {
  return c.get("user") as UserPayload;
}

// ── Public Auth routes ──
app.post("/auth/signup", async (c) => {
  const body = await c.req.json();
  const { email, password, name, role } = body;

  if (!email || !password || !name || !role) {
    return c.json({ error: "Email, password, name, and role are required." }, 400);
  }
  if (!["owner", "sitter"].includes(role)) {
    return c.json({ error: "Role must be 'owner' or 'sitter'." }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters." }, 400);
  }

  const result = createUser(email, password, name, role);
  if ("error" in result) {
    return c.json({ error: result.error }, 409);
  }

  return c.json({ user: result.user, token: result.token });
});

app.post("/auth/login", async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: "Email and password are required." }, 400);
  }

  const result = loginUser(email, password);
  if ("error" in result) {
    return c.json({ error: result.error }, 401);
  }

  return c.json({ user: result.user, token: result.token });
});

app.get("/auth/me", authMiddleware, (c) => {
  const user = getUser(c);
  const full = getUserById(user.userId);
  if (!full) return c.json({ error: "User not found" }, 404);
  return c.json({ user: full });
});

// ── Public Sitters routes ──
app.get("/sitters", (c) => {
  const sitters = getAllSitters();
  return c.json({ sitters });
});

app.get("/sitters/:id", (c) => {
  const id = c.req.param("id");
  const sitter = getSitterById(id);
  if (!sitter) return c.json({ error: "Sitter not found" }, 404);
  return c.json({ sitter });
});

// ── Protected: Bookings ──
app.get("/bookings", authMiddleware, (c) => {
  const user = getUser(c);

  let rows: any[];
  if (user.role === "owner") {
    rows = query(
      `SELECT b.*, sp.id as sitter_profile_id, sp.emoji as sitter_emoji, u2.name as sitter_name
       FROM bookings b
       JOIN sitter_profiles sp ON sp.user_id = b.sitter_id
       JOIN users u2 ON u2.id = b.sitter_id
       WHERE b.owner_id = ?
       ORDER BY b.created_at DESC`
    ).all(user.userId);
  } else {
    rows = query(
      `SELECT b.*, sp.id as sitter_profile_id, sp.emoji as sitter_emoji, u2.name as sitter_name
       FROM bookings b
       JOIN sitter_profiles sp ON sp.user_id = b.sitter_id
       JOIN users u2 ON u2.id = b.sitter_id
       WHERE b.sitter_id = ?
       ORDER BY b.created_at DESC`
    ).all(user.userId);
  }

  const bookings = rows.map((r: any) => ({
    id: r.id,
    sitterId: r.sitter_profile_id,
    sitterName: r.sitter_name,
    sitterEmoji: r.sitter_emoji,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    dogName: r.dog_name,
    dogBreed: r.dog_breed,
    address: r.address,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status,
    createdAt: r.created_at,
  }));

  return c.json({ bookings });
});

app.get("/bookings/:id", authMiddleware, (c) => {
  const user = getUser(c);
  const id = c.req.param("id");

  const row = query(
    `SELECT b.*, sp.id as sitter_profile_id, sp.emoji as sitter_emoji, u2.name as sitter_name
     FROM bookings b
     JOIN sitter_profiles sp ON sp.user_id = b.sitter_id
     JOIN users u2 ON u2.id = b.sitter_id
     WHERE b.id = ?`
  ).get(id) as any;

  if (!row) return c.json({ error: "Booking not found" }, 404);
  if (row.owner_id !== user.userId && row.sitter_id !== user.userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  return c.json({
    booking: {
      id: row.id,
      sitterId: row.sitter_profile_id,
      sitterName: row.sitter_name,
      sitterEmoji: row.sitter_emoji,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      dogName: row.dog_name,
      dogBreed: row.dog_breed,
      address: row.address,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      createdAt: row.created_at,
    },
  });
});

app.post("/bookings", authMiddleware, async (c) => {
  const user = getUser(c);
  if (user.role !== "owner") {
    return c.json({ error: "Only owners can create bookings" }, 403);
  }

  const body = await c.req.json();
  const { sitterId, dogName, dogBreed, address, date, startTime, endTime } = body;

  if (!sitterId || !dogName || !address || !date || !startTime || !endTime) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const sitterProfile = query("SELECT user_id FROM sitter_profiles WHERE id = ?").get(sitterId) as any;
  if (!sitterProfile) {
    return c.json({ error: "Sitter not found" }, 404);
  }

  const bookingId = generateId();
  run(
    `INSERT INTO bookings (id, sitter_id, owner_id, owner_name, dog_name, dog_breed, address, date, start_time, end_time, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
    bookingId, sitterProfile.user_id, user.userId, user.name, dogName, dogBreed || "", address, date, startTime, endTime
  );

  const row = query(
    `SELECT b.*, sp.id as sitter_profile_id, sp.emoji as sitter_emoji, u2.name as sitter_name
     FROM bookings b
     JOIN sitter_profiles sp ON sp.user_id = b.sitter_id
     JOIN users u2 ON u2.id = b.sitter_id
     WHERE b.id = ?`
  ).get(bookingId) as any;

  return c.json({
    booking: {
      id: row.id,
      sitterId: row.sitter_profile_id,
      sitterName: row.sitter_name,
      sitterEmoji: row.sitter_emoji,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      dogName: row.dog_name,
      dogBreed: row.dog_breed,
      address: row.address,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      createdAt: row.created_at,
    },
  });
});

app.patch("/bookings/:id/status", authMiddleware, async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const { status } = body;

  if (!["confirmed", "in-progress", "completed"].includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const booking = query("SELECT * FROM bookings WHERE id = ?").get(id) as any;
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.sitter_id !== user.userId && booking.owner_id !== user.userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  run("UPDATE bookings SET status = ? WHERE id = ?", status, id);
  return c.json({ success: true });
});

// ── Protected: Care Logs ──
app.get("/bookings/:id/care-logs", authMiddleware, (c) => {
  const user = getUser(c);
  const bookingId = c.req.param("id");

  const booking = query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as any;
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.owner_id !== user.userId && booking.sitter_id !== user.userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const rows = query("SELECT * FROM care_logs WHERE booking_id = ? ORDER BY timestamp DESC").all(bookingId);

  const logs = rows.map((r: any) => ({
    id: r.id,
    bookingId: r.booking_id,
    timestamp: r.timestamp,
    feeding: !!r.feeding,
    feedingNotes: r.feeding_notes,
    waterChanged: !!r.water_changed,
    treats: !!r.treats,
    treatNotes: r.treat_notes,
    playtimeMinutes: r.playtime_minutes,
    playtimeNotes: r.playtime_notes,
  }));

  return c.json({ logs });
});

app.post("/bookings/:id/care-logs", authMiddleware, async (c) => {
  const user = getUser(c);
  if (user.role !== "sitter") {
    return c.json({ error: "Only sitters can create care logs" }, 403);
  }

  const bookingId = c.req.param("id");

  const booking = query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as any;
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.sitter_id !== user.userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const body = await c.req.json();
  const logId = generateId();

  run(
    `INSERT INTO care_logs (id, booking_id, feeding, feeding_notes, water_changed, treats, treat_notes, playtime_minutes, playtime_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    logId, bookingId, body.feeding ? 1 : 0, body.feedingNotes || "",
    body.waterChanged ? 1 : 0, body.treats ? 1 : 0, body.treatNotes || "",
    body.playtimeMinutes || 0, body.playtimeNotes || ""
  );

  return c.json({
    log: {
      id: logId,
      bookingId,
      timestamp: new Date().toISOString(),
      feeding: !!body.feeding,
      feedingNotes: body.feedingNotes || "",
      waterChanged: !!body.waterChanged,
      treats: !!body.treats,
      treatNotes: body.treatNotes || "",
      playtimeMinutes: body.playtimeMinutes || 0,
      playtimeNotes: body.playtimeNotes || "",
    },
  });
});

// ── Protected: GPS ──
app.get("/bookings/:id/gps", authMiddleware, (c) => {
  const user = getUser(c);
  const bookingId = c.req.param("id");

  const booking = query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as any;
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.owner_id !== user.userId && booking.sitter_id !== user.userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const row = query(
    "SELECT * FROM gps_positions WHERE booking_id = ? ORDER BY timestamp DESC LIMIT 1"
  ).get(bookingId) as any;

  if (!row) return c.json({ position: null });

  return c.json({
    position: {
      bookingId: row.booking_id,
      lat: row.lat,
      lng: row.lng,
      timestamp: row.timestamp,
    },
  });
});

app.post("/bookings/:id/gps", authMiddleware, async (c) => {
  const user = getUser(c);
  if (user.role !== "sitter") {
    return c.json({ error: "Only sitters can share GPS" }, 403);
  }

  const bookingId = c.req.param("id");

  const booking = query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as any;
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.sitter_id !== user.userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const body = await c.req.json();
  const { lat, lng } = body;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return c.json({ error: "lat and lng are required" }, 400);
  }

  run("INSERT INTO gps_positions (booking_id, lat, lng) VALUES (?, ?, ?)", bookingId, lat, lng);

  run(
    `DELETE FROM gps_positions WHERE booking_id = ? AND id NOT IN (
       SELECT id FROM gps_positions WHERE booking_id = ? ORDER BY timestamp DESC LIMIT 100
     )`,
    bookingId, bookingId
  );

  return c.json({ success: true });
});

// ── Stripe Payment & Premium/Verification ──

// Payment webhook — records pending premium/verification after user says they paid
app.post("/stripe/payment-webhook", authMiddleware, async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const { type } = body; // "premium" or "verification"

  if (!type || !["premium", "verification"].includes(type)) {
    return c.json({ error: "Type must be 'premium' or 'verification'." }, 400);
  }

  if (type === "premium") {
    if (user.role !== "owner") {
      return c.json({ error: "Only owners can purchase premium." }, 403);
    }
    run("UPDATE users SET pending_premium = 1 WHERE id = ?", user.userId);
    return c.json({ success: true, message: "Premium payment recorded. Your premium status will activate shortly after verification." });
  }

  if (type === "verification") {
    if (user.role !== "sitter") {
      return c.json({ error: "Only sitters can get verified." }, 403);
    }
    run("UPDATE sitter_profiles SET pending_verification = 1 WHERE user_id = ?", user.userId);
    return c.json({ success: true, message: "Verification payment recorded. Your badge will appear after processing." });
  }
});

// Admin: mark user as premium
app.put("/users/me/premium", authMiddleware, (c) => {
  const user = getUser(c);

  const row = query("SELECT pending_premium FROM users WHERE id = ?").get(user.userId) as any;
  if (!row?.pending_premium) {
    return c.json({ error: "No pending premium payment found." }, 400);
  }

  // Set premium for 30 days from now
  const premiumUntil = new Date();
  premiumUntil.setDate(premiumUntil.getDate() + 30);
  const untilStr = premiumUntil.toISOString().split("T")[0];

  run("UPDATE users SET is_premium = 1, premium_until = ?, pending_premium = 0 WHERE id = ?", untilStr, user.userId);
  return c.json({ success: true, isPremium: true, premiumUntil: untilStr });
});

// Admin: mark sitter as verified
app.put("/sitters/me/verify", authMiddleware, (c) => {
  const user = getUser(c);

  if (user.role !== "sitter") {
    return c.json({ error: "Only sitters can be verified." }, 403);
  }

  const row = query("SELECT pending_verification FROM sitter_profiles WHERE user_id = ?").get(user.userId) as any;
  if (!row?.pending_verification) {
    return c.json({ error: "No pending verification payment found." }, 400);
  }

  run("UPDATE sitter_profiles SET is_verified = 1, pending_verification = 0 WHERE user_id = ?", user.userId);
  return c.json({ success: true, isVerified: true });
});

export default app;
