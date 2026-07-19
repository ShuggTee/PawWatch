import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  getCommunityData,
  type CommunityData,
  type CommunitySuccessStory,
  type CommunityVerifiedSitter,
} from "../data/api";
import { useAuth } from "../components/AuthContext";

const TIPS = [
  {
    emoji: "😰",
    title: "Separation Anxiety Tips",
    desc: "Start with short departures, leave a favorite toy, and keep arrivals low-key. Gradual desensitization helps your pup feel safe when you're away.",
  },
  {
    emoji: "🌳",
    title: "Best Dog Parks Near You",
    desc: "Look for parks with separate small/large dog areas, water stations, and shade. Always check recent reviews for cleanliness and safety before visiting.",
  },
  {
    emoji: "🍪",
    title: "Healthy Treat Recipes",
    desc: "Mix mashed banana with oat flour and a dash of peanut butter (xylitol-free!), bake at 350°F for 15 minutes. Your pup will love these homemade biscuits!",
  },
  {
    emoji: "☀️",
    title: "Summer Safety for Dogs",
    desc: "Walk during cooler hours, never leave your dog in a hot car, and always bring water. Watch for signs of overheating: excessive panting, drooling, or lethargy.",
  },
  {
    emoji: "🪥",
    title: "Dental Care at Home",
    desc: "Brush your dog's teeth 2-3 times per week with dog-safe toothpaste. Dental chews and toys can help reduce plaque between brushings. Healthy teeth = happy pup!",
  },
];

export default function Community() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCommunityData()
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load community data"))
      .finally(() => setLoading(false));
  }, []);

  const formatMinutes = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-100 via-amber-50 to-white">
        <div className="page-container pb-8 text-center">
          {/* Paw print decorations */}
          <div className="absolute left-4 top-4 text-4xl opacity-20 rotate-12 select-none pointer-events-none">
            🐾
          </div>
          <div className="absolute right-6 top-12 text-5xl opacity-15 -rotate-12 select-none pointer-events-none">
            🐾
          </div>
          <div className="absolute left-8 bottom-8 text-3xl opacity-10 rotate-45 select-none pointer-events-none">
            🐾
          </div>

          <div className="relative">
            <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-lg">
              <span className="text-6xl">👥</span>
            </div>
            <h1 className="mb-3 text-3xl font-extrabold text-gray-800 sm:text-4xl">
              PawWatch Community
            </h1>
            <p className="mx-auto mb-4 max-w-md text-base text-gray-600 sm:text-lg">
              Connect with fellow dog lovers, share tips, and celebrate your pups!
            </p>
            {!user && (
              <button
                onClick={() => navigate("/signup")}
                className="btn-primary px-8 py-3 text-base shadow-lg shadow-amber-500/25"
              >
                Join the Community →
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Community Stats */}
      <section className="bg-white py-10">
        <div className="page-container">
          <h2 className="section-title mb-6 text-center text-2xl">Our Community</h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="mb-2 h-8 w-8 rounded-full bg-amber-100" />
                  <div className="mb-1 h-6 w-16 rounded bg-gray-200" />
                  <div className="h-4 w-24 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="card text-center">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="card border-l-4 border-l-amber-400">
                <span className="text-2xl">🐕</span>
                <p className="mt-1 text-2xl font-extrabold text-gray-800">
                  {data?.stats.totalSitters ?? 0}
                </p>
                <p className="text-sm text-gray-500">Trusted Sitters</p>
              </div>
              <div className="card border-l-4 border-l-amber-400">
                <span className="text-2xl">🐶</span>
                <p className="mt-1 text-2xl font-extrabold text-gray-800">
                  {data?.stats.totalDogs ?? 0}
                </p>
                <p className="text-sm text-gray-500">Dogs Registered</p>
              </div>
              <div className="card border-l-4 border-l-green-400">
                <span className="text-2xl">✅</span>
                <p className="mt-1 text-2xl font-extrabold text-gray-800">
                  {data?.stats.totalBookings ?? 0}
                </p>
                <p className="text-sm text-gray-500">Bookings Completed</p>
              </div>
              <div className="card border-l-4 border-l-green-400">
                <span className="text-2xl">🎾</span>
                <p className="mt-1 text-2xl font-extrabold text-gray-800">
                  {formatMinutes(data?.stats.totalPlaytimeMinutes ?? 0)}
                </p>
                <p className="text-sm text-gray-500">Total Playtime</p>
              </div>
            </div>
          )}
          {data && data.stats.activeOwners > 0 && (
            <div className="mt-3 card border-l-4 border-l-blue-400 text-center">
              <span className="text-2xl">👨‍👩‍👧‍👦</span>
              <p className="mt-1 text-2xl font-extrabold text-gray-800">
                {data.stats.activeOwners}
              </p>
              <p className="text-sm text-gray-500">Active Owners</p>
            </div>
          )}
        </div>
      </section>

      {/* Member Spotlight: Verified Sitters */}
      {data && data.verifiedSitters.length > 0 && (
        <section className="bg-amber-50 py-10">
          <div className="page-container">
            <h2 className="section-title mb-6 text-center text-2xl">
              🌟 Member Spotlight
            </h2>
            <p className="mb-4 text-center text-sm text-gray-500">
              Our top verified sitters who go above and beyond
            </p>
            <div className="grid gap-4">
              {data.verifiedSitters.map((sitter: CommunityVerifiedSitter) => (
                <div key={sitter.id} className="card flex items-start gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl">
                    {sitter.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800 truncate">
                        {sitter.name}
                      </h3>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        ✅ Verified
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xs text-amber-400">★</span>
                      <span className="text-xs font-medium text-gray-600">
                        {sitter.rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({sitter.reviewCount} reviews)
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {sitter.bio}
                    </p>
                    {sitter.specialties.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sitter.specialties.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tips & Resources */}
      <section className="bg-white py-10">
        <div className="page-container">
          <h2 className="section-title mb-6 text-center text-2xl">
            📚 Tips &amp; Resources
          </h2>
          <p className="mb-4 text-center text-sm text-gray-500">
            Curated advice to help you be the best dog parent
          </p>
          <div className="grid gap-3">
            {TIPS.map((tip, i) => (
              <div key={i} className="card flex items-start gap-4 border-l-4 border-l-amber-400">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">
                  {tip.emoji}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-800">{tip.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                    {tip.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      {data && data.successStories.length > 0 && (
        <section className="bg-amber-50 py-10">
          <div className="page-container">
            <h2 className="section-title mb-6 text-center text-2xl">
              🎉 Success Stories
            </h2>
            <p className="mb-4 text-center text-sm text-gray-500">
              Happy pups and happy owners — real bookings from our community
            </p>
            <div className="grid gap-3">
              {data.successStories.slice(0, 4).map(
                (story: CommunitySuccessStory, i: number) => (
                  <div key={i} className="card">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg">
                        {story.sitterEmoji}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {story.sitterName} took great care of {story.dogName}
                        </p>
                        <p className="text-xs text-gray-400">
                          for {story.ownerName} • {new Date(story.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm italic text-gray-600">
                      🐾 A pawsome experience! {story.dogName}
                      {story.dogBreed ? ` (${story.dogBreed})` : ""} had a wonderful
                      time with {story.sitterName}.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      {!user && (
        <section className="bg-gradient-to-t from-amber-100 to-white py-12">
          <div className="page-container text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-200 text-4xl">
              🐾
            </div>
            <h2 className="mb-3 text-2xl font-bold text-gray-800">
              Ready to join the pack?
            </h2>
            <p className="mb-6 text-gray-500">
              Sign up today and become part of the PawWatch community.
            </p>
            <button
              onClick={() => navigate("/signup")}
              className="btn-primary px-10 py-4 text-lg shadow-lg shadow-amber-500/25"
            >
              Get Started →
            </button>
          </div>
        </section>
      )}

      {/* Bottom padding for nav */}
      <div className="h-4" />
    </div>
  );
}
