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
import {
  sendEmail,
  welcomeEmailBody,
  bookingConfirmationBody,
  sitterNotifyBody,
  careLogNotificationBody,
  buildCareSummary,
  getNotificationsForUser,
  videoNotificationBody,
} from "./email";

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

  // Send welcome email (fire and forget)
  sendEmail(
    email,
    "🐾 Welcome to PawWatch!",
    welcomeEmailBody(name),
    result.user.id,
    "welcome"
  ).catch((err) => console.error("Welcome email failed:", err));

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

// ── Sitter Availability ──
app.get("/sitters/:id/availability", authMiddleware, (c) => {
  const sitterId = c.req.param("id");
  const month = c.req.query("month"); // YYYY-MM

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: "month query parameter required (YYYY-MM)" }, 400);
  }

  // Look up the sitter's user_id from their profile id
  const sitterProfile = query(
    "SELECT user_id FROM sitter_profiles WHERE id = ?"
  ).get(sitterId) as any;
  if (!sitterProfile) {
    return c.json({ error: "Sitter not found" }, 404);
  }

  // Get all booked dates for this sitter in the given month
  const rows = query(
    `SELECT date FROM bookings
     WHERE sitter_id = ?
     AND date LIKE ?
     AND status IN ('confirmed', 'in-progress')
     GROUP BY date
     ORDER BY date`
  ).all(sitterProfile.user_id, `${month}%`);

  const bookedDates = rows.map((r: any) => r.date);

  return c.json({ bookedDates });
});

// ── Protected: Active bookings with GPS (for tracking tab) ──
app.get("/track", authMiddleware, (c) => {
  const user = getUser(c);
  if (user.role !== "owner") {
    return c.json({ error: "Only owners can access tracking" }, 403);
  }

  const rows = query(
    `SELECT b.*, sp.id as sitter_profile_id, sp.emoji as sitter_emoji, u2.name as sitter_name
     FROM bookings b
     JOIN sitter_profiles sp ON sp.user_id = b.sitter_id
     JOIN users u2 ON u2.id = b.sitter_id
     WHERE b.owner_id = ?
     AND b.status IN ('confirmed', 'in-progress')
     ORDER BY b.created_at DESC`
  ).all(user.userId) as any[];

  const bookings = rows.map((r: any) => {
    const gpsRow = query(
      "SELECT * FROM gps_positions WHERE booking_id = ? ORDER BY timestamp DESC LIMIT 1"
    ).get(r.id) as any;

    return {
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
      gps: gpsRow
        ? {
            lat: gpsRow.lat,
            lng: gpsRow.lng,
            timestamp: gpsRow.timestamp,
          }
        : null,
    };
  });

  return c.json({ bookings });
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
    `SELECT b.*, sp.id as sitter_profile_id, sp.emoji as sitter_emoji, u2.name as sitter_name, u2.email as sitter_email
     FROM bookings b
     JOIN sitter_profiles sp ON sp.user_id = b.sitter_id
     JOIN users u2 ON u2.id = b.sitter_id
     WHERE b.id = ?`
  ).get(bookingId) as any;

  const booking = {
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
  };

  // Send confirmation email to owner (fire and forget)
  sendEmail(
    user.email,
    "✅ Booking Confirmed — PawWatch",
    bookingConfirmationBody(
      user.name, row.sitter_name, dogName, date, startTime, endTime, address
    ),
    user.userId,
    "booking_confirmation_owner"
  ).catch((err) => console.error("Owner booking email failed:", err));

  // Notify sitter if they have a real email (not mock)
  const sitterEmail = row.sitter_email as string;
  if (sitterEmail && !sitterEmail.includes("pawwatch.internal")) {
    sendEmail(
      sitterEmail,
      "📋 New Booking Request — PawWatch",
      sitterNotifyBody(
        row.sitter_name, user.name, dogName, date, startTime, endTime
      ),
      row.sitter_id,
      "booking_confirmation_sitter"
    ).catch((err) => console.error("Sitter booking email failed:", err));
  }

  return c.json({ booking });
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

  // Send notification to the owner (fire and forget)
  const ownerRow = query("SELECT id, email, name FROM users WHERE id = ?").get(booking.owner_id) as any;
  if (ownerRow) {
    const summary = buildCareSummary(body);
    sendEmail(
      ownerRow.email || "",
      `🐕 Care Update: ${booking.dog_name} — PawWatch`,
      careLogNotificationBody(ownerRow.name, user.name, booking.dog_name, summary),
      booking.owner_id,
      "care_log"
    ).catch((err) => console.error("Care log email failed:", err));
  }

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

// ── Verification Applications ──

// Submit a verification application (sitter only)
app.post("/verify", authMiddleware, async (c) => {
  const user = getUser(c);
  if (user.role !== "sitter") {
    return c.json({ error: "Only sitters can submit verification applications." }, 403);
  }

  // Check for existing pending/approved application
  const existing = query(
    "SELECT id, status FROM verification_applications WHERE sitter_id = ? AND status IN ('pending', 'approved') ORDER BY created_at DESC LIMIT 1"
  ).get(user.userId) as any;
  if (existing) {
    if (existing.status === "approved") {
      return c.json({ error: "You are already verified." }, 409);
    }
    return c.json({ error: "You already have a pending verification application." }, 409);
  }

  const body = await c.req.json();
  const {
    fullName, phone, address, yearsExperience, certifications,
    firstAidCertified, reference1Name, reference1Phone, reference1Relationship,
    reference2Name, reference2Phone, reference2Relationship, consent
  } = body;

  if (!fullName || !phone || !address) {
    return c.json({ error: "Full name, phone, and address are required." }, 400);
  }
  if (!consent) {
    return c.json({ error: "You must consent to the background check." }, 400);
  }

  const appId = generateId();
  run(
    `INSERT INTO verification_applications
     (id, sitter_id, full_name, phone, address, years_experience, certifications,
      first_aid_certified, reference1_name, reference1_phone, reference1_relationship,
      reference2_name, reference2_phone, reference2_relationship, consent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    appId, user.userId, fullName, phone, address, yearsExperience || 0,
    certifications || "", firstAidCertified ? 1 : 0,
    reference1Name || "", reference1Phone || "", reference1Relationship || "",
    reference2Name || "", reference2Phone || "", reference2Relationship || "",
    consent ? 1 : 0
  );

  // Also set pending_verification on sitter profile
  run("UPDATE sitter_profiles SET pending_verification = 1 WHERE user_id = ?", user.userId);

  const row = query("SELECT * FROM verification_applications WHERE id = ?").get(appId) as any;

  return c.json({
    application: {
      id: row.id,
      sitterId: row.sitter_id,
      fullName: row.full_name,
      phone: row.phone,
      address: row.address,
      yearsExperience: row.years_experience,
      certifications: row.certifications,
      firstAidCertified: !!row.first_aid_certified,
      reference1Name: row.reference1_name,
      reference1Phone: row.reference1_phone,
      reference1Relationship: row.reference1_relationship,
      reference2Name: row.reference2_name,
      reference2Phone: row.reference2_phone,
      reference2Relationship: row.reference2_relationship,
      consent: !!row.consent,
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewNotes: row.review_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
});

// Get current verification status (sitter only)
app.get("/verify", authMiddleware, (c) => {
  const user = getUser(c);
  if (user.role !== "sitter") {
    return c.json({ error: "Only sitters can view verification status." }, 403);
  }

  // Check sitter_profile for verification status
  const profile = query(
    "SELECT is_verified, pending_verification FROM sitter_profiles WHERE user_id = ?"
  ).get(user.userId) as any;

  const isVerified = profile ? !!profile.is_verified : false;
  const pendingVerification = profile ? !!profile.pending_verification : false;

  // Get most recent application
  const application = query(
    "SELECT * FROM verification_applications WHERE sitter_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(user.userId) as any;

  return c.json({
    isVerified,
    pendingVerification,
    application: application ? {
      id: application.id,
      sitterId: application.sitter_id,
      fullName: application.full_name,
      phone: application.phone,
      address: application.address,
      yearsExperience: application.years_experience,
      certifications: application.certifications,
      firstAidCertified: !!application.first_aid_certified,
      reference1Name: application.reference1_name,
      reference1Phone: application.reference1_phone,
      reference1Relationship: application.reference1_relationship,
      reference2Name: application.reference2_name,
      reference2Phone: application.reference2_phone,
      reference2Relationship: application.reference2_relationship,
      consent: !!application.consent,
      status: application.status,
      reviewedBy: application.reviewed_by,
      reviewNotes: application.review_notes,
      createdAt: application.created_at,
      updatedAt: application.updated_at,
    } : null,
  });
});

// Admin: approve or reject a verification application
app.put("/verify/:id", authMiddleware, async (c) => {
  const user = getUser(c);
  const appId = c.req.param("id");
  const body = await c.req.json();
  const { status, reviewNotes } = body;

  if (!status || !["approved", "rejected"].includes(status)) {
    return c.json({ error: "Status must be 'approved' or 'rejected'." }, 400);
  }

  const application = query(
    "SELECT * FROM verification_applications WHERE id = ?"
  ).get(appId) as any;
  if (!application) {
    return c.json({ error: "Application not found." }, 404);
  }
  if (application.status !== "pending") {
    return c.json({ error: "Application has already been reviewed." }, 409);
  }

  run(
    "UPDATE verification_applications SET status = ?, reviewed_by = ?, review_notes = ?, updated_at = datetime('now') WHERE id = ?",
    status, user.userId, reviewNotes || null, appId
  );

  if (status === "approved") {
    // Mark the sitter as verified
    run("UPDATE sitter_profiles SET is_verified = 1, pending_verification = 0 WHERE user_id = ?", application.sitter_id);
  } else {
    // Clear pending flag on rejection
    run("UPDATE sitter_profiles SET pending_verification = 0 WHERE user_id = ?", application.sitter_id);
  }

  return c.json({ success: true, status });
});

// ── Notifications ──
app.get("/notifications", authMiddleware, (c) => {
  const user = getUser(c);
  const notifications = getNotificationsForUser(user.userId);
  return c.json({ notifications });
});

// ── Dogs ──
app.get("/dogs", authMiddleware, (c) => {
  const user = getUser(c);
  if (user.role !== "owner") {
    return c.json({ error: "Only owners can manage dogs" }, 403);
  }

  const rows = query(
    "SELECT * FROM dogs WHERE owner_id = ? ORDER BY created_at DESC"
  ).all(user.userId) as any[];

  const dogs = rows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    breed: r.breed,
    age: r.age,
    weight: r.weight,
    photoUrl: r.photo_url,
    bio: r.bio,
    notes: r.notes,
    createdAt: r.created_at,
  }));

  return c.json({ dogs });
});

app.post("/dogs", authMiddleware, async (c) => {
  const user = getUser(c);
  if (user.role !== "owner") {
    return c.json({ error: "Only owners can create dogs" }, 403);
  }

  const body = await c.req.json();
  const { name, breed, age, weight, photoUrl, bio, notes } = body;

  if (!name || !name.trim()) {
    return c.json({ error: "Dog name is required" }, 400);
  }

  const id = generateId();
  run(
    `INSERT INTO dogs (id, owner_id, name, breed, age, weight, photo_url, bio, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, user.userId, name.trim(), breed || "", age || 0, weight || 0, photoUrl || "", bio || "", notes || ""
  );

  const row = query("SELECT * FROM dogs WHERE id = ?").get(id) as any;

  return c.json({
    dog: {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      breed: row.breed,
      age: row.age,
      weight: row.weight,
      photoUrl: row.photo_url,
      bio: row.bio,
      notes: row.notes,
      createdAt: row.created_at,
    },
  });
});

app.put("/dogs/:id", authMiddleware, async (c) => {
  const user = getUser(c);
  if (user.role !== "owner") {
    return c.json({ error: "Only owners can update dogs" }, 403);
  }

  const dogId = c.req.param("id");
  const existing = query("SELECT * FROM dogs WHERE id = ? AND owner_id = ?").get(dogId, user.userId) as any;
  if (!existing) {
    return c.json({ error: "Dog not found" }, 404);
  }

  const body = await c.req.json();
  const { name, breed, age, weight, photoUrl, bio, notes } = body;

  if (!name || !name.trim()) {
    return c.json({ error: "Dog name is required" }, 400);
  }

  run(
    `UPDATE dogs SET name = ?, breed = ?, age = ?, weight = ?, photo_url = ?, bio = ?, notes = ? WHERE id = ? AND owner_id = ?`,
    name.trim(), breed || "", age || 0, weight || 0, photoUrl || "", bio || "", notes || "", dogId, user.userId
  );

  const row = query("SELECT * FROM dogs WHERE id = ?").get(dogId) as any;

  return c.json({
    dog: {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      breed: row.breed,
      age: row.age,
      weight: row.weight,
      photoUrl: row.photo_url,
      bio: row.bio,
      notes: row.notes,
      createdAt: row.created_at,
    },
  });
});

app.delete("/dogs/:id", authMiddleware, (c) => {
  const user = getUser(c);
  if (user.role !== "owner") {
    return c.json({ error: "Only owners can delete dogs" }, 403);
  }

  const dogId = c.req.param("id");
  const existing = query("SELECT * FROM dogs WHERE id = ? AND owner_id = ?").get(dogId, user.userId) as any;
  if (!existing) {
    return c.json({ error: "Dog not found" }, 404);
  }

  run("DELETE FROM dogs WHERE id = ? AND owner_id = ?", dogId, user.userId);
  return c.json({ success: true });
});

// ── Protected: Videos ──

// Upload a video for a booking (sitter only)
app.post("/bookings/:id/videos", authMiddleware, async (c) => {
  const user = getUser(c);
  if (user.role !== "sitter") {
    return c.json({ error: "Only sitters can upload videos" }, 403);
  }

  const bookingId = c.req.param("id");

  const booking = query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as any;
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.sitter_id !== user.userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const body = await c.req.json();
  const { videoData, filename, thumbnail, durationSeconds, careLogId } = body;

  if (!videoData || typeof videoData !== "string") {
    return c.json({ error: "videoData (base64) is required" }, 400);
  }

  // Rough 50MB base64 check: base64 is ~4/3 the original size, so ~67MB base64
  if (videoData.length > 70_000_000) {
    return c.json({ error: "Video too large. Maximum 50MB." }, 400);
  }

  const videoId = generateId();
  run(
    `INSERT INTO care_videos (id, booking_id, care_log_id, sitter_id, filename, video_data, thumbnail, duration_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    videoId, bookingId, careLogId || null, user.userId,
    filename || "video.mp4", videoData, thumbnail || "",
    durationSeconds || 0
  );

  // Send notification to the owner
  const ownerRow = query("SELECT id, email, name FROM users WHERE id = ?").get(booking.owner_id) as any;
  if (ownerRow) {
    sendEmail(
      ownerRow.email || "",
      `📹 ${user.name} sent you a video of ${booking.dog_name}! — PawWatch`,
      videoNotificationBody(ownerRow.name, user.name, booking.dog_name),
      booking.owner_id,
      "video_upload"
    ).catch((err) => console.error("Video notification email failed:", err));
  }

  const row = query("SELECT * FROM care_videos WHERE id = ?").get(videoId) as any;

  return c.json({
    video: {
      id: row.id,
      bookingId: row.booking_id,
      careLogId: row.care_log_id,
      sitterId: row.sitter_id,
      filename: row.filename,
      videoData: row.video_data,
      thumbnail: row.thumbnail,
      durationSeconds: row.duration_seconds,
      createdAt: row.created_at,
    },
  });
});

// List videos for a booking
app.get("/bookings/:id/videos", authMiddleware, (c) => {
  const user = getUser(c);
  const bookingId = c.req.param("id");

  const booking = query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as any;
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.owner_id !== user.userId && booking.sitter_id !== user.userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const rows = query(
    "SELECT * FROM care_videos WHERE booking_id = ? ORDER BY created_at DESC"
  ).all(bookingId);

  const videos = rows.map((r: any) => ({
    id: r.id,
    bookingId: r.booking_id,
    careLogId: r.care_log_id,
    sitterId: r.sitter_id,
    filename: r.filename,
    videoData: r.video_data,
    thumbnail: r.thumbnail,
    durationSeconds: r.duration_seconds,
    createdAt: r.created_at,
  }));

  return c.json({ videos });
});

// ── Protected: Activity feed (unified care logs + videos) ──
app.get("/activity", authMiddleware, (c) => {
  const user = getUser(c);
  if (user.role !== "owner") {
    return c.json({ error: "Only owners can access activity feed" }, 403);
  }

  const dogId = c.req.query("dog_id") || "";
  const dateFrom = c.req.query("from") || "";
  const dateTo = c.req.query("to") || "";
  const typeFilter = c.req.query("type") || ""; // feeding, water, treats, playtime, videos

  // Get the dog name if dog_id is provided
  let dogNameFilter = "";
  if (dogId) {
    const dog = query("SELECT name FROM dogs WHERE id = ? AND owner_id = ?").get(dogId, user.userId) as any;
    if (dog) {
      dogNameFilter = dog.name;
    } else {
      return c.json({ entries: [], stats: { walksThisWeek: 0, feedingStreak: 0, lastVideo: null } });
    }
  }

  // Build WHERE clauses for care_logs
  const careLogConditions: string[] = ["b.owner_id = ?"];
  const careLogParams: unknown[] = [user.userId];

  if (dogNameFilter) {
    careLogConditions.push("b.dog_name = ?");
    careLogParams.push(dogNameFilter);
  }
  if (dateFrom) {
    careLogConditions.push("cl.timestamp >= ?");
    careLogParams.push(dateFrom);
  }
  if (dateTo) {
    careLogConditions.push("cl.timestamp <= ?");
    careLogParams.push(dateTo + " 23:59:59");
  }

  // Build WHERE clauses for videos
  const videoConditions: string[] = ["b.owner_id = ?"];
  const videoParams: unknown[] = [user.userId];

  if (dogNameFilter) {
    videoConditions.push("b.dog_name = ?");
    videoParams.push(dogNameFilter);
  }
  if (dateFrom) {
    videoConditions.push("cv.created_at >= ?");
    videoParams.push(dateFrom);
  }
  if (dateTo) {
    videoConditions.push("cv.created_at <= ?");
    videoParams.push(dateTo + " 23:59:59");
  }

  const entries: any[] = [];

  // Fetch care logs
  if (!typeFilter || ["feeding", "water", "treats", "playtime"].includes(typeFilter)) {
    const careLogWhere = careLogConditions.join(" AND ");
    const careLogRows = query(
      `SELECT 
        cl.id, cl.booking_id, cl.timestamp,
        cl.feeding, cl.feeding_notes, cl.water_changed,
        cl.treats, cl.treat_notes, cl.playtime_minutes, cl.playtime_notes,
        b.dog_name, b.dog_breed, b.owner_id,
        u2.name as sitter_name, sp.emoji as sitter_emoji
       FROM care_logs cl
       JOIN bookings b ON cl.booking_id = b.id
       JOIN sitter_profiles sp ON sp.user_id = b.sitter_id
       JOIN users u2 ON u2.id = b.sitter_id
       WHERE ${careLogWhere}
       ORDER BY cl.timestamp DESC
       LIMIT 200`
    ).all(...careLogParams) as any[];

    for (const r of careLogRows) {
      // Type filter (skip if this log doesn't match the requested type)
      if (typeFilter) {
        if (typeFilter === "feeding" && !r.feeding) continue;
        if (typeFilter === "water" && !r.water_changed) continue;
        if (typeFilter === "treats" && !r.treats) continue;
        if (typeFilter === "playtime" && !r.playtime_minutes) continue;
      }
      entries.push({
        id: r.id,
        entryType: "care_log",
        bookingId: r.booking_id,
        timestamp: r.timestamp,
        dogName: r.dog_name,
        dogBreed: r.dog_breed,
        sitterName: r.sitter_name,
        sitterEmoji: r.sitter_emoji,
        feeding: !!r.feeding,
        feedingNotes: r.feeding_notes || "",
        waterChanged: !!r.water_changed,
        treats: !!r.treats,
        treatNotes: r.treat_notes || "",
        playtimeMinutes: r.playtime_minutes || 0,
        playtimeNotes: r.playtime_notes || "",
      });
    }
  }

  // Fetch videos
  if (!typeFilter || typeFilter === "videos") {
    const videoWhere = videoConditions.join(" AND ");
    const videoRows = query(
      `SELECT 
        cv.id, cv.booking_id, cv.created_at as timestamp,
        cv.filename, cv.video_data, cv.thumbnail, cv.duration_seconds,
        b.dog_name, b.dog_breed,
        u2.name as sitter_name, sp.emoji as sitter_emoji
       FROM care_videos cv
       JOIN bookings b ON cv.booking_id = b.id
       JOIN sitter_profiles sp ON sp.user_id = b.sitter_id
       JOIN users u2 ON u2.id = b.sitter_id
       WHERE ${videoWhere}
       ORDER BY cv.created_at DESC
       LIMIT 100`
    ).all(...videoParams) as any[];

    for (const r of videoRows) {
      entries.push({
        id: r.id,
        entryType: "video",
        bookingId: r.booking_id,
        timestamp: r.timestamp,
        dogName: r.dog_name,
        dogBreed: r.dog_breed,
        sitterName: r.sitter_name,
        sitterEmoji: r.sitter_emoji,
        filename: r.filename,
        videoData: r.video_data,
        thumbnail: r.thumbnail,
        durationSeconds: r.duration_seconds || 0,
      });
    }
  }

  // Sort merged entries by timestamp descending
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // ── Summary stats ──
  // Total playtime this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  const playtimeRow = query(
    `SELECT COALESCE(SUM(cl.playtime_minutes), 0) as total
     FROM care_logs cl
     JOIN bookings b ON cl.booking_id = b.id
     WHERE b.owner_id = ? AND cl.timestamp >= ?`
  ).get(user.userId, weekAgoStr) as any;
  const walksThisWeek = playtimeRow?.total || 0;

  // Feeding streak (consecutive days with at least one feeding)
  const feedingDays = query(
    `SELECT DISTINCT date(cl.timestamp) as day
     FROM care_logs cl
     JOIN bookings b ON cl.booking_id = b.id
     WHERE b.owner_id = ? AND cl.feeding = 1
     ORDER BY day DESC
     LIMIT 60`
  ).all(user.userId) as any[];

  let feedingStreak = 0;
  const todayStr = new Date().toISOString().split("T")[0];
  const feedingDaySet = new Set(feedingDays.map((r: any) => r.day));

  if (feedingDaySet.has(todayStr)) {
    feedingStreak = 1;
    const d = new Date();
    while (true) {
      d.setDate(d.getDate() - 1);
      const check = d.toISOString().split("T")[0];
      if (feedingDaySet.has(check)) {
        feedingStreak++;
      } else {
        break;
      }
    }
  }

  // Last video received
  const lastVideoRow = query(
    `SELECT cv.id, cv.created_at, cv.thumbnail, b.dog_name
     FROM care_videos cv
     JOIN bookings b ON cv.booking_id = b.id
     WHERE b.owner_id = ?
     ORDER BY cv.created_at DESC LIMIT 1`
  ).get(user.userId) as any;

  const stats = {
    walksThisWeek,
    feedingStreak,
    lastVideo: lastVideoRow ? {
      id: lastVideoRow.id,
      timestamp: lastVideoRow.created_at,
      thumbnail: lastVideoRow.thumbnail,
      dogName: lastVideoRow.dog_name,
    } : null,
  };

  return c.json({ entries, stats });
});

export default app;
