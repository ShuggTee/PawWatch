import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSitters } from "../data/api";
import type { Sitter } from "../types";

export default function Sitters() {
  const navigate = useNavigate();
  const [sitters, setSitters] = useState<Sitter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSitters()
      .then(setSitters)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <div className="text-center text-gray-400">
          <span className="mb-2 block text-3xl animate-pulse">🐾</span>
          <p>Loading sitters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h2 className="section-title flex items-center gap-2">
        <span>🔍</span> Available Sitters
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Tap a sitter to book them for your pup.
      </p>

      <div className="grid gap-4">
        {sitters.map((sitter) => (
          <button
            key={sitter.id}
            onClick={() => navigate(`/book/${sitter.id}`)}
            className="card flex gap-4 text-left transition-all hover:shadow-md active:scale-[0.98]"
          >
            {/* Photo placeholder */}
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-3xl">
              {sitter.emoji}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800">{sitter.name}</h3>
                {sitter.isVerified && (
                  <span className="text-sm" title="Verified Sitter">
                    ✅
                  </span>
                )}
                <span className="flex items-center gap-0.5 text-sm font-medium text-amber-600">
                  ⭐ {sitter.rating}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {sitter.bio}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {sitter.specialties.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  {sitter.reviewCount} reviews
                </span>
                <span className="font-semibold text-amber-700">
                  ${sitter.pricePerHour}/hr
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
