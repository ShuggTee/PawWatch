export interface Sitter {
  id: string;
  name: string;
  emoji: string;
  rating: number;
  reviewCount: number;
  bio: string;
  pricePerHour: number;
  specialties: string[];
  isVerified?: boolean;
}

export interface Booking {
  id: string;
  sitterId: string;
  ownerName: string;
  dogName: string;
  dogBreed: string;
  address: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: "confirmed" | "in-progress" | "completed";
  createdAt: string;
}

export interface CareLog {
  id: string;
  bookingId: string;
  timestamp: string;
  feeding: boolean;
  feedingNotes: string;
  waterChanged: boolean;
  treats: boolean;
  treatNotes: string;
  playtimeMinutes: number;
  playtimeNotes: string;
}

export interface GpsPosition {
  bookingId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export type AppRole = "owner" | "sitter";

export interface EmailNotification {
  id: string;
  userId: string;
  type: string;
  subject: string;
  body: string;
  sentAt: string;
}
