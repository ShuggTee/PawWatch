import type { Booking, CareLog, GpsPosition, Sitter, EmailNotification } from "../types";

const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("pawwatch_token");
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

// ── Auth ──
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "sitter";
  isPremium?: boolean;
  premiumUntil?: string | null;
  isVerified?: boolean;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export async function signup(
  email: string,
  password: string,
  name: string,
  role: "owner" | "sitter"
): Promise<AuthResult> {
  const data = await apiFetch<AuthResult>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name, role }),
  });
  localStorage.setItem("pawwatch_token", data.token);
  localStorage.setItem("pawwatch_user", JSON.stringify(data.user));
  return data;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const data = await apiFetch<AuthResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("pawwatch_token", data.token);
  localStorage.setItem("pawwatch_user", JSON.stringify(data.user));
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await apiFetch<{ user: AuthUser }>("/auth/me");
  localStorage.setItem("pawwatch_user", JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem("pawwatch_token");
  localStorage.removeItem("pawwatch_user");
}

export function getSavedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("pawwatch_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getSavedToken(): string | null {
  return localStorage.getItem("pawwatch_token");
}

// ── Sitters ──
export async function getSitters(): Promise<Sitter[]> {
  const data = await apiFetch<{ sitters: Sitter[] }>("/sitters");
  return data.sitters;
}

export async function getSitter(id: string): Promise<Sitter> {
  const data = await apiFetch<{ sitter: Sitter }>(`/sitters/${id}`);
  return data.sitter;
}

// ── Bookings ──
export interface BookingWithSitter extends Booking {
  sitterName?: string;
  sitterEmoji?: string;
  ownerId?: string;
}

export async function getBookings(): Promise<BookingWithSitter[]> {
  const data = await apiFetch<{ bookings: BookingWithSitter[] }>("/bookings");
  return data.bookings;
}

export async function getBooking(
  id: string
): Promise<BookingWithSitter | undefined> {
  try {
    const data = await apiFetch<{ booking: BookingWithSitter }>(
      `/bookings/${id}`
    );
    return data.booking;
  } catch {
    return undefined;
  }
}

export async function createBooking(bookingData: {
  sitterId: string;
  dogName: string;
  dogBreed: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<BookingWithSitter> {
  const data = await apiFetch<{ booking: BookingWithSitter }>("/bookings", {
    method: "POST",
    body: JSON.stringify(bookingData),
  });
  return data.booking;
}

export async function updateBookingStatus(
  id: string,
  status: Booking["status"]
): Promise<void> {
  await apiFetch(`/bookings/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ── Care Logs ──
export async function getCareLogs(bookingId: string): Promise<CareLog[]> {
  const data = await apiFetch<{ logs: CareLog[] }>(
    `/bookings/${bookingId}/care-logs`
  );
  return data.logs;
}

export async function addCareLog(
  bookingId: string,
  logData: {
    feeding: boolean;
    feedingNotes: string;
    waterChanged: boolean;
    treats: boolean;
    treatNotes: string;
    playtimeMinutes: number;
    playtimeNotes: string;
  }
): Promise<CareLog> {
  const data = await apiFetch<{ log: CareLog }>(
    `/bookings/${bookingId}/care-logs`,
    {
      method: "POST",
      body: JSON.stringify(logData),
    }
  );
  return data.log;
}

// ── GPS ──
export async function getLatestGps(
  bookingId: string
): Promise<GpsPosition | null> {
  const data = await apiFetch<{ position: GpsPosition | null }>(
    `/bookings/${bookingId}/gps`
  );
  return data.position;
}

export async function saveGpsPosition(
  bookingId: string,
  lat: number,
  lng: number
): Promise<void> {
  await apiFetch(`/bookings/${bookingId}/gps`, {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
}

// ── Stripe Payment & Premium/Verification ──
export async function submitPayment(
  type: "premium" | "verification"
): Promise<{ success: boolean; message: string }> {
  const data = await apiFetch<{ success: boolean; message: string }>(
    "/stripe/payment-webhook",
    {
      method: "POST",
      body: JSON.stringify({ type }),
    }
  );
  return data;
}

export async function activatePremium(): Promise<{
  success: boolean;
  isPremium: boolean;
  premiumUntil: string;
}> {
  const data = await apiFetch<{
    success: boolean;
    isPremium: boolean;
    premiumUntil: string;
  }>("/users/me/premium", {
    method: "PUT",
  });
  return data;
}

export async function verifySitter(): Promise<{
  success: boolean;
  isVerified: boolean;
}> {
  const data = await apiFetch<{ success: boolean; isVerified: boolean }>(
    "/sitters/me/verify",
    {
      method: "PUT",
    }
  );
  return data;
}

// ── Notifications ──
export async function getNotifications(): Promise<EmailNotification[]> {
  const data = await apiFetch<{ notifications: EmailNotification[] }>(
    "/notifications"
  );
  return data.notifications;
}
