import type { Booking, CareLog, GpsPosition } from "../types";

const BOOKINGS_KEY = "pawwatch_bookings";
const CARELOGS_KEY = "pawwatch_carelogs";
const GPS_KEY = "pawwatch_gps";

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Bookings
export function getBookings(): Booking[] {
  return load<Booking>(BOOKINGS_KEY);
}

export function getBooking(id: string): Booking | undefined {
  return getBookings().find((b) => b.id === id);
}

export function addBooking(booking: Booking): void {
  const bookings = getBookings();
  bookings.push(booking);
  save(BOOKINGS_KEY, bookings);
}

export function updateBookingStatus(
  id: string,
  status: Booking["status"]
): void {
  const bookings = getBookings();
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx !== -1) {
    bookings[idx].status = status;
    save(BOOKINGS_KEY, bookings);
  }
}

// Care Logs
export function getCareLogs(bookingId: string): CareLog[] {
  return load<CareLog>(CARELOGS_KEY)
    .filter((l) => l.bookingId === bookingId)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

export function addCareLog(log: CareLog): void {
  const logs = load<CareLog>(CARELOGS_KEY);
  logs.push(log);
  save(CARELOGS_KEY, logs);
}

// GPS
export function getLatestGps(bookingId: string): GpsPosition | undefined {
  const positions = load<GpsPosition>(GPS_KEY)
    .filter((p) => p.bookingId === bookingId)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  return positions[0];
}

export function saveGpsPosition(position: GpsPosition): void {
  const positions = load<GpsPosition>(GPS_KEY);
  positions.push(position);
  // Keep only last 100 positions per booking
  const bookingPositions = positions.filter(
    (p) => p.bookingId === position.bookingId
  );
  if (bookingPositions.length > 100) {
    const toRemove = bookingPositions.slice(
      0,
      bookingPositions.length - 100
    );
    const newPositions = positions.filter(
      (p) => !toRemove.some((r) => r.timestamp === p.timestamp)
    );
    save(GPS_KEY, newPositions);
  } else {
    save(GPS_KEY, positions);
  }
}

// Generate simple IDs
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
