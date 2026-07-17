import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../components/AuthContext";
import { submitPayment } from "../data/api";

const PREMIUM_LINK = "https://buy.stripe.com/fZu5kD7vc2Y0dlW42v2cg00";
const VERIFICATION_LINK = "https://buy.stripe.com/eVq9AT7vc568bdOfLd2cg01";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [premiumMessage, setPremiumMessage] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");

  const handleGoPremium = async () => {
    window.open(PREMIUM_LINK, "_blank");
    try {
      const result = await submitPayment("premium");
      setPremiumMessage(result.message);
    } catch {
      setPremiumMessage("Payment recorded. Your premium status will activate shortly after verification.");
    }
  };

  const handleGetVerified = async () => {
    window.open(VERIFICATION_LINK, "_blank");
    try {
      const result = await submitPayment("verification");
      setVerifyMessage(result.message);
    } catch {
      setVerifyMessage("Payment recorded. Your verification badge will appear after processing.");
    }
  };

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-amber-100 text-5xl">
          🐾
        </div>
        <h1 className="mb-2 text-3xl font-bold text-gray-800">
          Peace of mind while you&apos;re away
        </h1>
        <p className="text-gray-500">
          Book vetted sitters, track visits in real-time, and get complete care
          logs — all in one place.
        </p>
      </div>

      {!user || user.role === "owner" ? (
        <>
          {/* Owner CTA */}
          <div className="mb-6 grid gap-4">
            <button
              onClick={() => navigate("/sitters")}
              className="btn-primary text-lg"
            >
              🔍 Find a Sitter
            </button>
            {user && (
              <button
                onClick={() => navigate("/bookings")}
                className="btn-secondary"
              >
                📋 View My Bookings
              </button>
            )}
            {!user && (
              <button
                onClick={() => navigate("/signup")}
                className="btn-secondary"
              >
                👤 Create Account to Book
              </button>
            )}
          </div>

          {/* Premium upsell for logged-in free-tier owners */}
          {user && user.role === "owner" && !user.isPremium && (
            <div className="card mb-6 border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⭐</span>
                <h3 className="font-bold text-gray-800">Upgrade to Premium</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Unlock GPS tracking, care log history beyond 7 days, and multi-dog support.
              </p>
              <ul className="text-xs text-gray-500 mb-3 space-y-1">
                <li>📍 Real-time GPS tracking</li>
                <li>📝 Extended care log history</li>
                <li>🐕 Multi-dog support</li>
              </ul>
              <button onClick={handleGoPremium} className="btn-primary w-full text-sm">
                Go Premium — $7/month
              </button>
              {premiumMessage && (
                <p className="mt-2 text-xs text-green-600 font-medium">{premiumMessage}</p>
              )}
            </div>
          )}

          {/* Premium badge for premium owners */}
          {user && user.role === "owner" && user.isPremium && (
            <div className="card mb-6 border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⭐</span>
                <div>
                  <h3 className="font-bold text-gray-800">Premium Member</h3>
                  <p className="text-sm text-gray-600">
                    {user.premiumUntil
                      ? `Active until ${user.premiumUntil}`
                      : "Enjoying all premium features!"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feature highlights */}
          <div className="grid gap-3">
            <div className="card flex items-start gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <h3 className="font-semibold text-gray-800">Easy Booking</h3>
                <p className="text-sm text-gray-500">
                  Browse vetted sitters and book in seconds.
                </p>
              </div>
            </div>
            <div className="card flex items-start gap-3">
              <span className="text-2xl">📍</span>
              <div>
                <h3 className="font-semibold text-gray-800">GPS Tracking</h3>
                <p className="text-sm text-gray-500">
                  See when your sitter arrives and know your pup is cared for.
                </p>
              </div>
            </div>
            <div className="card flex items-start gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="font-semibold text-gray-800">Daily Care Log</h3>
                <p className="text-sm text-gray-500">
                  Track feeding, water, treats, and playtime in real-time.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Sitter CTA */}
          <div className="mb-6 grid gap-4">
            <button
              onClick={() => navigate("/sitter-dashboard")}
              className="btn-primary text-lg"
            >
              📋 View My Jobs
            </button>
          </div>

          {/* Verification upsell for unverified sitters */}
          {!user.isVerified && (
            <div className="card mb-6 border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-amber-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">✅</span>
                <h3 className="font-bold text-gray-800">Get Verified</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Stand out with a verified badge. Appears on your profile and in search results.
              </p>
              <ul className="text-xs text-gray-500 mb-3 space-y-1">
                <li>🔵 Blue checkmark badge</li>
                <li>📈 Higher ranking in search</li>
                <li>🤝 More trust from owners</li>
              </ul>
              <button onClick={handleGetVerified} className="btn-primary w-full text-sm">
                Get Verified — $25 one-time
              </button>
              {verifyMessage && (
                <p className="mt-2 text-xs text-green-600 font-medium">{verifyMessage}</p>
              )}
            </div>
          )}

          {/* Verified badge for verified sitters */}
          {user.isVerified && (
            <div className="card mb-6 border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-amber-50">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <h3 className="font-bold text-gray-800">Verified Sitter</h3>
                  <p className="text-sm text-gray-600">
                    Your verified badge is active on your profile.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sitter info */}
          <div className="grid gap-3">
            <div className="card flex items-start gap-3">
              <span className="text-2xl">📍</span>
              <div>
                <h3 className="font-semibold text-gray-800">Share Location</h3>
                <p className="text-sm text-gray-500">
                  Let owners know when you arrive with GPS check-in.
                </p>
              </div>
            </div>
            <div className="card flex items-start gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="font-semibold text-gray-800">Log Care</h3>
                <p className="text-sm text-gray-500">
                  Quick care log after each visit — feeding, water, treats, playtime.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
