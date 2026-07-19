import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveBookings, type ActiveBooking } from "../data/api";
import { useAuth } from "../components/AuthContext";
import LeafletMap, { type MapSitter } from "../components/LeafletMap";

const ARRIVAL_RADIUS_METERS = 100;
// Fallback home - in a real app this would come from the user's profile
const OWNER_HOME = { lat: 37.7749, lng: -122.4194 };

function calcDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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
}

export default function Track() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<ActiveBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSitter, setSelectedSitter] = useState<MapSitter | null>(null);

  const fetchBookings = useCallback(() => {
    if (!user || user.role !== "owner") return;

    getActiveBookings()
      .then((data) => {
        setBookings(data);
        setError("");
      })
      .catch((err) => {
        setError(err.message || "Failed to load tracking data");
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    fetchBookings();
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchBookings, 15000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  // Build sitter markers
  const sitterMarkers: MapSitter[] = bookings
    .filter((b) => b.gps)
    .map((b) => {
      const dist = calcDistance(
        b.gps!.lat,
        b.gps!.lng,
        OWNER_HOME.lat,
        OWNER_HOME.lng
      );
      const distMeters = Math.round(dist);
      const arrived = dist <= ARRIVAL_RADIUS_METERS;
      return {
        lat: b.gps!.lat,
        lng: b.gps!.lng,
        name: b.sitterName,
        emoji: b.sitterEmoji,
        distance: distMeters,
        arrived,
        status: b.status,
        dogName: b.dogName,
        bookingId: b.id,
      } as MapSitter & { bookingId: string };
    });

  if (!user) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🔒
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">Sign in required</h2>
        <p className="mb-6 text-gray-500">Sign in to track your sitters.</p>
        <button onClick={() => navigate("/signin")} className="btn-primary">
          Sign In
        </button>
      </div>
    );
  }

  if (user.role !== "owner") {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🐾
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">Sitter Dashboard</h2>
        <p className="mb-6 text-gray-500">
          The tracking view is for owners. Go to your dashboard to manage your jobs.
        </p>
        <button
          onClick={() => navigate("/sitter-dashboard")}
          className="btn-primary"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <div className="text-center text-gray-400">
          <span className="mb-2 block text-3xl animate-pulse">🐾</span>
          <p>Loading tracking data...</p>
        </div>
      </div>
    );
  }

  const activeSittersCount = sitterMarkers.length;
  const bookingsWithoutGps = bookings.filter(
    (b) => !b.gps && b.status === "in-progress"
  );

  return (
    <div className="page-container">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">📍 Track Sitters</h2>
        <span className="text-xs text-gray-400">
          Auto-refreshes every 15s
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
          <button
            onClick={fetchBookings}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Full-screen map */}
      {activeSittersCount > 0 ? (
        <div className="card mb-4 overflow-hidden !p-0">
          <LeafletMap
            sitters={sitterMarkers}
            homePosition={OWNER_HOME}
            showHome={true}
            fullScreen={true}
            tracking={true}
            onSitterClick={(s) =>
              setSelectedSitter(
                selectedSitter?.lat === s.lat ? null : s
              )
            }
          />
        </div>
      ) : (
        <div className="card mb-4">
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="mb-3 text-5xl">🗺️</span>
            <h3 className="mb-2 text-lg font-semibold text-gray-600">
              No active sitters
            </h3>
            <p className="mb-1 text-sm">
              {bookings.length > 0
                ? "Your sitters haven't started sharing their location yet."
                : "You don't have any active or confirmed bookings."}
            </p>
            {bookingsWithoutGps.length > 0 && (
              <p className="mt-2 text-xs text-amber-500">
                {bookingsWithoutGps.length} in-progress booking
                {bookingsWithoutGps.length > 1 ? "s" : ""} waiting for GPS
              </p>
            )}
            <button
              onClick={() => navigate("/bookings")}
              className="btn-secondary mt-4 text-sm"
            >
              View My Bookings
            </button>
          </div>
        </div>
      )}

      {/* Selected sitter detail card */}
      {selectedSitter && (
        <div className="card mb-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
              {selectedSitter.emoji || "🐾"}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800">
                {selectedSitter.name}
              </h3>
              {selectedSitter.dogName && (
                <p className="text-sm text-gray-500">
                  🐕 {selectedSitter.dogName}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs text-gray-400">Distance</p>
              <p className="font-semibold text-gray-700">
                {selectedSitter.distance != null
                  ? `${selectedSitter.distance}m`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs text-gray-400">Status</p>
              <p className="font-semibold text-gray-700">
                {selectedSitter.arrived ? "✅ Arrived!" : "📍 En route"}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const s = selectedSitter as MapSitter & { bookingId?: string };
              if (s.bookingId) navigate(`/booking/${s.bookingId}`);
            }}
            className="btn-secondary mt-3 w-full text-sm"
          >
            View Booking Details
          </button>
        </div>
      )}

      {/* Active booking list (non-map fallback) */}
      {bookings.length > 0 && activeSittersCount === 0 && (
        <div className="card">
          <h3 className="section-title text-sm">Your Active Bookings</h3>
          <div className="grid gap-2">
            {bookings.map((b) => (
              <div
                key={b.id}
                onClick={() => navigate(`/booking/${b.id}`)}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3 hover:bg-amber-50"
              >
                <span className="text-2xl">{b.sitterEmoji || "🐾"}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-700">
                    {b.sitterName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {b.dogName} · {b.date} · {b.startTime}–{b.endTime}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    b.status === "in-progress"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {b.status === "in-progress" ? "Active" : "Confirmed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
