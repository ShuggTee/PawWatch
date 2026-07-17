import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBookings, type BookingWithSitter } from "../data/api";
import { useAuth } from "../components/AuthContext";

export default function Bookings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithSitter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getBookings()
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🔒
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">Sign in to view bookings</h2>
        <p className="mb-6 text-gray-500">
          Sign in or create an account to manage your bookings.
        </p>
        <div className="grid gap-3">
          <button onClick={() => navigate("/signin")} className="btn-primary">
            Sign In
          </button>
          <button onClick={() => navigate("/signup")} className="btn-secondary">
            Create Account
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <div className="text-center text-gray-400">
          <span className="mb-2 block text-3xl animate-pulse">📋</span>
          <p>Loading bookings...</p>
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          📋
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">No bookings yet</h2>
        <p className="mb-6 text-gray-500">
          {user.role === "owner"
            ? "Find a sitter to book your first visit."
            : "No jobs assigned yet."}
        </p>
        {user.role === "owner" && (
          <button
            onClick={() => navigate("/sitters")}
            className="btn-primary"
          >
            Find a Sitter
          </button>
        )}
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: "bg-green-100 text-green-700",
      "in-progress": "bg-blue-100 text-blue-700",
      completed: "bg-gray-100 text-gray-600",
    };
    return (
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          colors[status] || colors.confirmed
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="page-container">
      <h2 className="section-title flex items-center gap-2">
        <span>📋</span> {user.role === "owner" ? "My Bookings" : "My Jobs"}
      </h2>

      <div className="grid gap-3">
        {bookings.map((booking) => (
          <button
            key={booking.id}
            onClick={() => navigate(`/booking/${booking.id}`)}
            className="card flex items-center gap-3 text-left transition-all hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">
              {booking.sitterEmoji || "🐾"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  {booking.dogName || "Your dog"}
                </h3>
                {statusBadge(booking.status)}
              </div>
              <p className="text-sm text-gray-500">
                {booking.sitterName || "Sitter"} · {booking.date} ·{" "}
                {booking.startTime}–{booking.endTime}
              </p>
            </div>
            <span className="text-gray-300 text-lg">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
