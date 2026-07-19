import type { Booking, CareLog, GpsPosition, Sitter, EmailNotification, Dog, CareVideo, ActivityResponse, VerificationApplication } from "../types";

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

// ── Active bookings with GPS (Tracking tab) ──
export interface ActiveBooking {
  id: string;
  sitterId: string;
  sitterName?: string;
  sitterEmoji?: string;
  ownerId?: string;
  ownerName: string;
  dogName: string;
  dogBreed: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
  gps: { lat: number; lng: number; timestamp: string } | null;
}

export async function getActiveBookings(): Promise<ActiveBooking[]> {
  const data = await apiFetch<{ bookings: ActiveBooking[] }>("/track");
  return data.bookings;
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

// ── Dogs ──
export async function getDogs(): Promise<Dog[]> {
  const data = await apiFetch<{ dogs: Dog[] }>("/dogs");
  return data.dogs;
}

export async function createDog(dogData: {
  name: string;
  breed?: string;
  age?: number;
  weight?: number;
  photoUrl?: string;
  bio?: string;
  notes?: string;
}): Promise<Dog> {
  const data = await apiFetch<{ dog: Dog }>("/dogs", {
    method: "POST",
    body: JSON.stringify(dogData),
  });
  return data.dog;
}

export async function updateDog(
  id: string,
  dogData: {
    name: string;
    breed?: string;
    age?: number;
    weight?: number;
    photoUrl?: string;
    bio?: string;
    notes?: string;
  }
): Promise<Dog> {
  const data = await apiFetch<{ dog: Dog }>(`/dogs/${id}`, {
    method: "PUT",
    body: JSON.stringify(dogData),
  });
  return data.dog;
}

export async function deleteDog(id: string): Promise<void> {
  await apiFetch(`/dogs/${id}`, { method: "DELETE" });
}

// ── Sitter Availability ──
export async function getSitterAvailability(
  sitterId: string,
  month: string
): Promise<string[]> {
  const data = await apiFetch<{ bookedDates: string[] }>(
    `/sitters/${sitterId}/availability?month=${month}`
  );
  return data.bookedDates;
}

// ── Videos ──
export async function uploadVideo(
  bookingId: string,
  videoData: {
    videoData: string; // base64
    filename: string;
    thumbnail: string;
    durationSeconds: number;
    careLogId?: string;
  }
): Promise<CareVideo> {
  const data = await apiFetch<{ video: CareVideo }>(
    `/bookings/${bookingId}/videos`,
    {
      method: "POST",
      body: JSON.stringify(videoData),
    }
  );
  return data.video;
}

export async function getVideos(bookingId: string): Promise<CareVideo[]> {
  const data = await apiFetch<{ videos: CareVideo[] }>(
    `/bookings/${bookingId}/videos`
  );
  return data.videos;
}

// ── Activity feed ──
export async function getActivity(params?: {
  dog_id?: string;
  from?: string;
  to?: string;
  type?: string;
}): Promise<ActivityResponse> {
  const searchParams = new URLSearchParams();
  if (params?.dog_id) searchParams.set("dog_id", params.dog_id);
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  if (params?.type) searchParams.set("type", params.type);
  const qs = searchParams.toString();
  const data = await apiFetch<ActivityResponse>(
    `/activity${qs ? `?${qs}` : ""}`
  );
  return data;
}

// ── Verification ──
export interface VerificationStatus {
  isVerified: boolean;
  pendingVerification: boolean;
  application: VerificationApplication | null;
}

export async function submitVerification(data: {
  fullName: string;
  phone: string;
  address: string;
  yearsExperience: number;
  certifications: string;
  firstAidCertified: boolean;
  reference1Name: string;
  reference1Phone: string;
  reference1Relationship: string;
  reference2Name: string;
  reference2Phone: string;
  reference2Relationship: string;
  consent: boolean;
}): Promise<VerificationApplication> {
  const result = await apiFetch<{ application: VerificationApplication }>("/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result.application;
}

export async function getVerificationStatus(): Promise<VerificationStatus> {
  return apiFetch<VerificationStatus>("/verify");
}

export async function reviewVerification(
  appId: string,
  review: { status: "approved" | "rejected"; reviewNotes?: string }
): Promise<{ success: boolean; status: string }> {
  return apiFetch<{ success: boolean; status: string }>(`/verify/${appId}`, {
    method: "PUT",
    body: JSON.stringify(review),
  });
}
