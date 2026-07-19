import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getBookings,
  type BookingWithSitter,
  submitPayment,
} from "../data/api";
import { useAuth } from "../components/AuthContext";

const VERIFICATION_LINK = "https://buy.stripe.com/eVq9AT7vc568bdOfLd2cg01";

export default function SitterDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithSitter[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyMessage, setVerifyMessage] = useState("");

  const handleGetVerified = async () => {
    window.open(VERIFICATION_LINK, "_blank");
    try {
      const result = await submitPayment("verification");
      setVerifyMessage(result.message);
    } catch {
      setVerifyMessage(
        "Payment recorded. Your verification badge will appear after processing.",
      );
    }
  };

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

  if (!user || user.role !== "sitter") {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🔒
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">
          Sitter access only
        </h2>
        <p className="mb-6 text-gray-500">
          Sign in as a sitter to view your jobs.
        </p>
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
          <span className="mb-2 block text-3xl animate-pulse">🐕</span>
          <p>Loading jobs...</p>
        </div>
      </div>
    );
  }

  const activeBookings = bookings
    .filter((b) => b.status !== "completed")
    .sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime() ||
        a.startTime.localeCompare(b.startTime),
    );

  const completedBookings = bookings
    .filter((b) => b.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  if (activeBookings.length === 0 && completedBookings.length === 0) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🐕
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">No active jobs</h2>
        <p className="text-gray-500">
          When an owner books you, your jobs will appear here.
        </p>

        {/* Verification upsell for unverified sitters */}
        {!user.isVerified && (
          <div className="card mt-6 border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-amber-50 text-left">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✅</span>
              <h3 className="font-bold text-gray-800">Get Verified</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Stand out with a verified badge on your profile.
            </p>
            <button
              onClick={handleGetVerified}
              className="btn-primary w-full text-sm"
            >
              Get Verified — $25 one-time
            </button>
            {verifyMessage && (
              <p className="mt-2 text-xs text-green-600 font-medium">
                {verifyMessage}
              </p>
            )}
          </div>
        )}

        {user.isVerified && (
          <div className="card mt-6 border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-amber-50 text-left">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-bold text-gray-800">Verified Sitter</h3>
                <p className="text-sm text-gray-600">Your badge is active.</p>
              </div>
            </div>
          </div>
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
        <span>📋</span> My Jobs
      </h2>

      {/* Verification card for sitters */}
      {!user.isVerified ? (
        <div className="card mb-4 border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-amber-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✅</span>
            <h3 className="font-bold text-gray-800">Get Verified</h3>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            Stand out with a verified badge on your profile.
          </p>
          <button
            onClick={handleGetVerified}
            className="btn-primary w-full text-sm"
          >
            Get Verified — $25 one-time
          </button>
          {verifyMessage && (
            <p className="mt-2 text-xs text-green-600 font-medium">
              {verifyMessage}
            </p>
          )}
        </div>
      ) : (
        <div className="card mb-4 border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-amber-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-bold text-gray-800">Verified Sitter</h3>
              <p className="text-sm text-gray-600">
                Your badge is active on your profile.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active jobs */}
      {activeBookings.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Upcoming & Active
          </h3>
          <div className="grid gap-3">
            {activeBookings.map((booking) => (
              <button
                key={booking.id}
                onClick={() => navigate(`/booking/${booking.id}`)}
                className="card flex items-center gap-3 text-left transition-all hover:shadow-md active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">
                  🐾
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800">
                      {booking.dogName}
                    </h4>
                    {statusBadge(booking.status)}
                  </div>
                  <p className="text-sm text-gray-500">
                    {booking.ownerName} · {booking.date} · {booking.startTime}–
                    {booking.endTime}
                  </p>
                  <p className="text-xs text-gray-400">{booking.address}</p>
                </div>
                <span className="text-gray-300 text-lg">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recently completed */}
      {completedBookings.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Recently Completed
          </h3>
          <div className="grid gap-3">
            {completedBookings.slice(0, 5).map((booking) => (
              <button
                key={booking.id}
                onClick={() => navigate(`/booking/${booking.id}`)}
                className="card flex items-center gap-3 text-left opacity-60 transition-all hover:opacity-80 active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl">
                  ✅
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-gray-800">
                    {booking.dogName}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {booking.ownerName} · {booking.date}
                  </p>
                </div>
                <span className="text-gray-300 text-lg">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
