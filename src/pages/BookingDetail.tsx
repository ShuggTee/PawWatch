import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getBooking,
  getCareLogs,
  addCareLog,
  getLatestGps,
  saveGpsPosition,
  updateBookingStatus,
  getVideos,
  uploadVideo,
  type BookingWithSitter,
} from "../data/api";
import { useAuth } from "../components/AuthContext";
import type { CareLog, GpsPosition, CareVideo } from "../types";
import LeafletMap from "../components/LeafletMap";

const ARRIVAL_RADIUS_METERS = 100;
const OWNER_HOME = { lat: 37.7749, lng: -122.4194 }; // fallback default

export default function BookingDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState<BookingWithSitter | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [videos, setVideos] = useState<CareVideo[]>([]);

  // GPS state for sitter
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [watchId, setWatchId] = useState<number | null>(null);
  const [arrived, setArrived] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  // Care log form
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({
    feeding: false,
    feedingNotes: "",
    waterChanged: false,
    treats: false,
    treatNotes: "",
    playtimeMinutes: 0,
    playtimeNotes: "",
  });

  // Video state
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoPlayer, setVideoPlayer] = useState<CareVideo | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Haversine distance in meters
  const calcDistance = useCallback(
    (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371000;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    []
  );

  // Load booking, logs, and videos
  useEffect(() => {
    if (!bookingId || !user) return;
    setLoading(true);
    Promise.all([
      getBooking(bookingId),
      getCareLogs(bookingId),
      getLatestGps(bookingId),
      getVideos(bookingId),
    ])
      .then(([b, l, pos, vids]) => {
        setBooking(b || null);
        setLogs(l);
        setVideos(vids);
        if (pos) {
          setCurrentPos({ lat: pos.lat, lng: pos.lng });
          const dist = calcDistance(pos.lat, pos.lng, OWNER_HOME.lat, OWNER_HOME.lng);
          setDistance(Math.round(dist));
          setArrived(dist <= ARRIVAL_RADIUS_METERS);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId, user, calcDistance]);

  // GPS tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported in this browser.");
      return;
    }

    setTracking(true);
    setGpsError("");

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentPos({ lat, lng });

        // Save to API
        if (bookingId) {
          saveGpsPosition(bookingId, lat, lng).catch(() => {});
        }

        // Check arrival distance
        const dist = calcDistance(lat, lng, OWNER_HOME.lat, OWNER_HOME.lng);
        setDistance(Math.round(dist));
        if (dist <= ARRIVAL_RADIUS_METERS && !arrived) {
          setArrived(true);
          if (bookingId) updateBookingStatus(bookingId, "in-progress").catch(() => {});
        }
      },
      (err) => {
        setGpsError(`GPS error: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    setWatchId(id);
  }, [bookingId, calcDistance, arrived]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation?.clearWatch(watchId);
      setWatchId(null);
    }
    setTracking(false);
  }, [watchId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
    };
  }, [watchId]);

  // Submit care log
  const submitCareLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    try {
      const log = await addCareLog(bookingId, logForm);
      setLogs((prev) => [log, ...prev]);
      setShowLogForm(false);
      setLogForm({
        feeding: false,
        feedingNotes: "",
        waterChanged: false,
        treats: false,
        treatNotes: "",
        playtimeMinutes: 0,
        playtimeNotes: "",
      });
    } catch {}
  };

  // Handle video file selection
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bookingId) return;

    // Check size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert("Video too large. Maximum 50MB.");
      return;
    }

    // For non-video files (image mock), just reject
    if (!file.type.startsWith("video/")) {
      alert("Please select a video file.");
      return;
    }

    setUploadingVideo(true);
    try {
      // Read as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Strip data URL prefix to get raw base64
          const base64 = result.split(",")[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      // Generate a thumbnail from the video
      let thumbnail = "";
      try {
        thumbnail = await generateVideoThumbnail(file);
      } catch {
        // Thumbnail generation failed, continue without
      }

      // Get duration
      let durationSeconds = 0;
      try {
        durationSeconds = await getVideoDuration(file);
      } catch {
        // Duration extraction failed, continue without
      }

      const video = await uploadVideo(bookingId, {
        videoData: base64Data,
        filename: file.name,
        thumbnail,
        durationSeconds,
      });

      setVideos((prev) => [video, ...prev]);
    } catch (err: any) {
      alert(err?.message || "Failed to upload video. Please try again.");
    } finally {
      setUploadingVideo(false);
      // Reset input
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  if (!user) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🔒
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">Sign in required</h2>
        <p className="mb-6 text-gray-500">Sign in to view booking details.</p>
        <button onClick={() => navigate("/signin")} className="btn-primary">
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <div className="text-center text-gray-400">
          <span className="mb-2 block text-3xl animate-pulse">🐾</span>
          <p>Loading booking...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="page-container text-center">
        <p className="text-gray-500">Booking not found.</p>
        <button onClick={() => navigate("/bookings")} className="btn-secondary mt-4">
          Back to bookings
        </button>
      </div>
    );
  }

  const isSitter = user.role === "sitter";
  const isPremiumOwner = user.role === "owner" && user.isPremium;

  // Filter logs for non-premium owners to last 7 days
  const filteredLogs = (() => {
    if (isSitter || isPremiumOwner) return logs;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return logs.filter((log) => new Date(log.timestamp) >= sevenDaysAgo);
  })();

  const hasPremiumGate = user.role === "owner" && !user.isPremium;
  const hiddenLogCount = logs.length - filteredLogs.length;

  return (
    <div className="page-container">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
      >
        ← Back
      </button>

      {/* Booking info card */}
      <div className="card mb-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
            {booking.sitterEmoji || "🐾"}
          </div>
          <div>
            <h2 className="font-bold text-gray-800">
              {booking.dogName}&apos;s Visit
            </h2>
            <p className="text-sm text-gray-500">
              {booking.sitterName} · {booking.date} · {booking.startTime}–
              {booking.endTime}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              booking.status === "completed"
                ? "bg-gray-100 text-gray-600"
                : booking.status === "in-progress"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-green-100 text-green-700"
            }`}
          >
            {booking.status}
          </span>
          <span className="text-xs text-gray-400">
            {booking.ownerName} · {booking.address}
          </span>
        </div>
      </div>

      {/* GPS Tracking Section */}
      <div className="card mb-4">
        <h3 className="section-title flex items-center gap-2">
          <span>📍</span> GPS Tracking
        </h3>

        {hasPremiumGate ? (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-4 text-center">
            <p className="text-sm text-gray-600 mb-2">
              ⭐ GPS tracking is a premium feature.
            </p>
            <button onClick={() => navigate("/")} className="text-sm font-semibold text-amber-600 hover:text-amber-700">
              Upgrade to Premium →
            </button>
          </div>
        ) : (
          <>
            {/* Map / position display */}
            <div className="mb-3">
              {currentPos ? (
                <>
                  <LeafletMap
                    sitters={[
                      {
                        lat: currentPos.lat,
                        lng: currentPos.lng,
                        name: isSitter ? "You" : booking.sitterName,
                        emoji: isSitter ? "📍" : booking.sitterEmoji,
                        distance,
                        arrived,
                      },
                    ]}
                    homePosition={OWNER_HOME}
                    tracking={tracking}
                    showHome={!isSitter || tracking}
                    centerOnSitter={tracking}
                    fallbackContent={
                      <div className="rounded-xl bg-amber-50/50 p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                          <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                          Live position
                        </div>
                        <div className="mb-1 font-mono text-sm text-gray-700">
                          Lat: {currentPos.lat.toFixed(6)}
                        </div>
                        <div className="mb-2 font-mono text-sm text-gray-700">
                          Lng: {currentPos.lng.toFixed(6)}
                        </div>
                        {distance !== null && (
                          <div
                            className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                              arrived
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {arrived
                              ? "✅ Sitter has arrived at your home!"
                              : `📍 ${distance}m from your home`}
                          </div>
                        )}
                      </div>
                    }
                  />
                  {distance !== null && (
                    <div
                      className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                        arrived
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {arrived
                        ? "✅ Sitter has arrived at your home!"
                        : `📍 ${distance}m from your home`}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl bg-amber-50/50 py-8 text-gray-400">
                  <LeafletMap
                    sitters={[]}
                    homePosition={OWNER_HOME}
                    showHome={true}
                    fallbackContent={
                      <>
                        <span className="mb-2 text-3xl">📍</span>
                        <p className="text-sm">
                          {isSitter
                            ? "Start sharing to show your location"
                            : "Waiting for sitter to share location"}
                        </p>
                      </>
                    }
                  />
                </div>
              )}
            </div>

            {/* Sitter GPS controls */}
            {isSitter && (
              <div className="flex gap-2">
                {!tracking ? (
                  <button onClick={startTracking} className="btn-primary flex-1">
                    📍 Start Sharing Location
                  </button>
                ) : (
                  <button onClick={stopTracking} className="btn-secondary flex-1">
                    ⏹ Stop Sharing
                  </button>
                )}
              </div>
            )}

            {gpsError && (
              <p className="mt-2 text-sm text-red-500">{gpsError}</p>
            )}

            {!isSitter && currentPos && (
              <p className="mt-2 text-xs text-gray-400">
                Sitter location updates in real-time while they share.
              </p>
            )}
          </>
        )}
      </div>

      {/* Care Logs Section */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title flex items-center gap-2 mb-0">
            <span>📝</span> Care Log
          </h3>
          {isSitter && booking.status !== "completed" && (
            <button
              onClick={() => setShowLogForm(!showLogForm)}
              className="btn-sm btn-primary"
            >
              {showLogForm ? "Cancel" : "+ Add Entry"}
            </button>
          )}
        </div>

        {/* Care log form */}
        {showLogForm && (
          <form
            onSubmit={submitCareLog}
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
          >
            {/* Feeding */}
            <div className="mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={logForm.feeding}
                  onChange={(e) =>
                    setLogForm((p) => ({ ...p, feeding: e.target.checked }))
                  }
                  className="h-5 w-5 rounded accent-amber-500"
                />
                <span className="font-semibold text-gray-700">Fed 🍖</span>
              </label>
              {logForm.feeding && (
                <input
                  placeholder="What did they eat? (notes)"
                  value={logForm.feedingNotes}
                  onChange={(e) =>
                    setLogForm((p) => ({ ...p, feedingNotes: e.target.value }))
                  }
                  className="mt-2"
                />
              )}
            </div>

            {/* Water */}
            <div className="mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={logForm.waterChanged}
                  onChange={(e) =>
                    setLogForm((p) => ({
                      ...p,
                      waterChanged: e.target.checked,
                    }))
                  }
                  className="h-5 w-5 rounded accent-amber-500"
                />
                <span className="font-semibold text-gray-700">
                  Water bowl changed 💧
                </span>
              </label>
            </div>

            {/* Treats */}
            <div className="mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={logForm.treats}
                  onChange={(e) =>
                    setLogForm((p) => ({ ...p, treats: e.target.checked }))
                  }
                  className="h-5 w-5 rounded accent-amber-500"
                />
                <span className="font-semibold text-gray-700">
                  Treats given 🦴
                </span>
              </label>
              {logForm.treats && (
                <input
                  placeholder="What treats? (notes)"
                  value={logForm.treatNotes}
                  onChange={(e) =>
                    setLogForm((p) => ({ ...p, treatNotes: e.target.value }))
                  }
                  className="mt-2"
                />
              )}
            </div>

            {/* Playtime */}
            <div className="mb-3">
              <label className="font-semibold text-gray-700">
                Playtime ⚽ (minutes)
              </label>
              <input
                type="number"
                min="0"
                max="240"
                value={logForm.playtimeMinutes}
                onChange={(e) =>
                  setLogForm((p) => ({
                    ...p,
                    playtimeMinutes: parseInt(e.target.value) || 0,
                  }))
                }
                className="mt-1"
              />
              <input
                placeholder="What did you play? (notes)"
                value={logForm.playtimeNotes}
                onChange={(e) =>
                  setLogForm((p) => ({
                    ...p,
                    playtimeNotes: e.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>

            {/* Video upload button in care log form */}
            <div className="mb-3 rounded-lg border border-dashed border-amber-300 bg-white p-3">
              <p className="mb-2 text-sm font-semibold text-gray-700">
                📹 Record a video update
              </p>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                onChange={handleVideoSelect}
                className="hidden"
                id="video-upload-input"
              />
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploadingVideo}
                className="btn-sm bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
              >
                {uploadingVideo ? "Uploading..." : "📹 Record / Choose Video"}
              </button>
              <p className="mt-1 text-xs text-gray-400">
                Max 30 sec, 50MB. Opens camera on mobile.
              </p>
            </div>

            <button type="submit" className="btn-primary w-full">
              Save Care Log Entry
            </button>
          </form>
        )}

        {/* Log entries */}
        {filteredLogs.length === 0 && !showLogForm && (
          <div className="py-6 text-center text-gray-400">
            <span className="text-2xl">📝</span>
            <p className="mt-1 text-sm">No care log entries yet.</p>
          </div>
        )}

        <div className="grid gap-3">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-amber-100 bg-amber-50/50 p-3"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                <span>{new Date(log.timestamp).toLocaleString()}</span>
                {/* Video count badge for this log */}
                {videos.filter((v) => v.careLogId === log.id).length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                    📹 {videos.filter((v) => v.careLogId === log.id).length}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-sm">
                <div className="flex items-center gap-1.5">
                  <span>{log.feeding ? "✅" : "❌"}</span>
                  <span className="text-gray-600">Fed</span>
                  {log.feedingNotes && (
                    <span className="text-xs text-gray-400">
                      — {log.feedingNotes}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span>{log.waterChanged ? "✅" : "❌"}</span>
                  <span className="text-gray-600">Water changed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>{log.treats ? "✅" : "❌"}</span>
                  <span className="text-gray-600">Treats</span>
                  {log.treatNotes && (
                    <span className="text-xs text-gray-400">
                      — {log.treatNotes}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span>⚽</span>
                  <span className="text-gray-600">
                    {log.playtimeMinutes}min play
                  </span>
                  {log.playtimeNotes && (
                    <span className="text-xs text-gray-400">
                      — {log.playtimeNotes}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Premium upsell for non-premium owners when logs are truncated */}
        {hasPremiumGate && hiddenLogCount > 0 && (
          <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50/50 p-3 text-center">
            <p className="text-sm text-gray-600">
              {hiddenLogCount} older {hiddenLogCount === 1 ? "entry" : "entries"} hidden.
            </p>
            <button onClick={() => navigate("/")} className="text-sm font-semibold text-amber-600 hover:text-amber-700 mt-1 inline-block">
              ⭐ Upgrade to Premium to view full history →
            </button>
          </div>
        )}
      </div>

      {/* Video Gallery Section */}
      {videos.length > 0 && (
        <div className="card mt-4">
          <h3 className="section-title flex items-center gap-2 mb-3">
            <span>📹</span> Videos
            <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
              {videos.length}
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.map((video) => (
              <div
                key={video.id}
                onClick={() => setVideoPlayer(video)}
                className="cursor-pointer overflow-hidden rounded-xl border border-amber-100 bg-gray-100 transition hover:shadow-md"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-200">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt="Video thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-300 text-3xl text-gray-500">
                      📹
                    </div>
                  )}
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white text-lg">
                      ▶
                    </div>
                  </div>
                  {/* Duration badge */}
                  {video.durationSeconds > 0 && (
                    <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                      {formatDuration(video.durationSeconds)}
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="p-2">
                  <p className="text-xs text-gray-500 truncate">
                    {new Date(video.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full-screen Video Player Modal */}
      {videoPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setVideoPlayer(null)}
        >
          <div
            className="relative w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setVideoPlayer(null)}
              className="absolute -top-10 right-0 text-2xl text-white hover:text-gray-300"
            >
              ✕
            </button>

            {/* Video player */}
            <video
              src={`data:video/mp4;base64,${videoPlayer.videoData}`}
              controls
              autoPlay
              className="w-full rounded-xl"
              style={{ maxHeight: "80vh" }}
            >
              Your browser does not support video playback.
            </video>

            {/* Video info */}
            <div className="mt-2 text-center text-sm text-gray-300">
              {new Date(videoPlayer.createdAt).toLocaleString()}
              {videoPlayer.durationSeconds > 0 && (
                <> · {formatDuration(videoPlayer.durationSeconds)}</>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Generate a thumbnail (first frame) from a video file.
 * Uses a hidden <video> element + canvas to capture the first frame.
 */
function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      // Seek to 1 second or 10% of duration for a meaningful frame
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL("image/jpeg", 0.7);
      URL.revokeObjectURL(url);
      resolve(thumbnail);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to generate thumbnail"));
    };

    // Timeout after 10 seconds
    setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Thumbnail generation timed out"));
    }, 10000);
  });
}

/**
 * Get the duration of a video file in seconds.
 */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(video.duration));
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to get video duration"));
    };

    setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Duration extraction timed out"));
    }, 5000);
  });
}
