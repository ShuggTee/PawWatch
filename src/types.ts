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

export interface Dog {
  id: string;
  ownerId: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  photoUrl: string;
  bio: string;
  notes: string;
  createdAt: string;
}

export interface CareVideo {
  id: string;
  bookingId: string;
  careLogId: string | null;
  sitterId: string;
  filename: string;
  videoData: string; // base64
  thumbnail: string; // base64 data URL or empty
  durationSeconds: number;
  createdAt: string;
}

export interface EmailNotification {
  id: string;
  userId: string;
  type: string;
  subject: string;
  body: string;
  sentAt: string;
}

export interface ActivityCareLogEntry {
  id: string;
  entryType: "care_log";
  bookingId: string;
  timestamp: string;
  dogName: string;
  dogBreed: string;
  sitterName: string;
  sitterEmoji: string;
  feeding: boolean;
  feedingNotes: string;
  waterChanged: boolean;
  treats: boolean;
  treatNotes: string;
  playtimeMinutes: number;
  playtimeNotes: string;
}

export interface ActivityVideoEntry {
  id: string;
  entryType: "video";
  bookingId: string;
  timestamp: string;
  dogName: string;
  dogBreed: string;
  sitterName: string;
  sitterEmoji: string;
  filename: string;
  videoData: string;
  thumbnail: string;
  durationSeconds: number;
}

export type ActivityEntry = ActivityCareLogEntry | ActivityVideoEntry;

export interface ActivityStats {
  walksThisWeek: number;
  feedingStreak: number;
  lastVideo: { id: string; timestamp: string; thumbnail: string; dogName: string } | null;
}

export interface ActivityResponse {
  entries: ActivityEntry[];
  stats: ActivityStats;
}
