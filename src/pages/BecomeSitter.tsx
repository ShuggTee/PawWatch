import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { mockSitters } from "../data/sitters";

const FAQS = [
  {
    q: "How do I get paid?",
    a: "Owners pay through the app when they book, and you'll receive your earnings via direct deposit within 2-3 business days after each completed booking. We handle all the payment processing so you can focus on the dogs.",
  },
  {
    q: "What's required to become a sitter?",
    a: "You must be at least 18 years old, pass a basic background check, and have a genuine love for dogs! No professional experience is required — just reliability, patience, and good communication skills. Create your free profile and you're ready to start.",
  },
  {
    q: "How does verification work?",
    a: "Verification is our way of giving owners extra confidence. For a one-time $25 fee, we run a comprehensive background check and verify your identity. Once approved, you'll get a blue verified badge on your profile that helps you stand out in search results and earn more bookings.",
  },
  {
    q: "Can I set my own rates?",
    a: "Absolutely! You have full control over your hourly rate. Most sitters on PawWatch charge between $20-30 per hour. You can adjust your rate anytime, and we'll show you what comparable sitters in your area are charging to help you stay competitive.",
  },
  {
    q: "How do bookings work?",
    a: "Owners browse sitter profiles, check availability, and send booking requests. You'll receive a notification and can accept or decline. Once confirmed, the app handles everything — GPS check-in when you arrive, a built-in care log for each visit, and automatic payment after completion.",
  },
];

export default function BecomeSitter() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Use sitters with highest ratings for testimonials
  const topSitters = [...mockSitters]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  const testimonials = [
    {
      name: topSitters[0]?.name ?? "Sarah Johnson",
      emoji: topSitters[0]?.emoji ?? "🐕",
      text: "I've been sitting on PawWatch for 6 months and it's been amazing. The GPS check-in gives owners so much peace of mind, and I love how easy the care log is. I earn about $800/week working my own schedule!",
    },
    {
      name: topSitters[1]?.name ?? "Emily Davis",
      emoji: topSitters[1]?.emoji ?? "🦮",
      text: "Getting verified was the best decision — my bookings nearly doubled afterward. The app handles everything from scheduling to payments, so I can just focus on giving the dogs the best care possible.",
    },
    {
      name: topSitters[2]?.name ?? "Mike Chen",
      emoji: topSitters[2]?.emoji ?? "🐾",
      text: "As a student, the flexibility of PawWatch is perfect. I set my schedule around classes and can take on as many or as few bookings as I want. The owners are wonderful and the app makes communication effortless.",
    },
  ];

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
              <span className="text-6xl">🐕</span>
            </div>
            <h1 className="mb-3 text-3xl font-extrabold text-gray-800 sm:text-4xl">
              Earn money doing what you love
            </h1>
            <p className="mx-auto mb-6 max-w-md text-base text-gray-600 sm:text-lg">
              Flexible dog sitting on your schedule. Set your own rates, choose
              your clients, and get paid to hang out with amazing dogs.
            </p>
            <button
              onClick={() => navigate("/signup?role=sitter")}
              className="btn-primary px-10 py-4 text-lg shadow-lg shadow-amber-500/25"
            >
              Become a Sitter
            </button>
            <p className="mt-3 text-xs text-gray-400">
              Free to sign up • No experience required
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-12">
        <div className="page-container">
          <h2 className="section-title mb-8 text-center text-2xl">
            How it works
          </h2>
          <div className="grid gap-6">
            {/* Step 1 */}
            <div className="card flex items-start gap-4 border-l-4 border-l-amber-400">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-600">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Create your free profile
                </h3>
                <p className="text-sm text-gray-500">
                  Tell us about yourself, your experience with dogs, and upload
                  a photo. It takes less than 5 minutes and it's completely free.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="card flex items-start gap-4 border-l-4 border-l-amber-400">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-600">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Set your schedule and rates
                </h3>
                <p className="text-sm text-gray-500">
                  Choose when you're available and how much you charge. Work
                  mornings, evenings, weekends — whatever fits your life.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="card flex items-start gap-4 border-l-4 border-l-amber-400">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-600">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Get booked by local dog owners
                </h3>
                <p className="text-sm text-gray-500">
                  Owners in your area find your profile and send booking
                  requests. Accept the ones that work for you — you're always in
                  control.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-amber-50 py-12">
        <div className="page-container">
          <h2 className="section-title mb-8 text-center text-2xl">
            Why join PawWatch?
          </h2>
          <div className="grid gap-3">
            <div className="card flex items-start gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Keep majority of your earnings
                </h3>
                <p className="text-sm text-gray-500">
                  We only take a small 15-20% booking fee. You keep 80-85% of
                  every booking — more than most platforms.
                </p>
              </div>
            </div>

            <div className="card flex items-start gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Flexible schedule
                </h3>
                <p className="text-sm text-gray-500">
                  Work when you want. Set your own availability and only accept
                  bookings that fit your life.
                </p>
              </div>
            </div>

            <div className="card flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Get verified to boost your bookings
                </h3>
                <p className="text-sm text-gray-500">
                  Stand out with a verified badge. Verified sitters appear
                  higher in search and get more booking requests.
                </p>
              </div>
            </div>

            <div className="card flex items-start gap-3">
              <span className="text-2xl">📍</span>
              <div>
                <h3 className="font-semibold text-gray-800">
                  GPS check-in gives owners peace of mind
                </h3>
                <p className="text-sm text-gray-500">
                  One-tap check-in when you arrive. Owners love knowing exactly
                  when their pup is being cared for.
                </p>
              </div>
            </div>

            <div className="card flex items-start gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Easy care logging built in
                </h3>
                <p className="text-sm text-gray-500">
                  Log feeding, water changes, treats, and playtime in seconds.
                  Owners get a complete record of every visit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Earnings Preview */}
      <section className="bg-white py-12">
        <div className="page-container">
          <h2 className="section-title mb-8 text-center text-2xl">
            What you can earn
          </h2>
          <div className="card mb-4 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <div className="mb-4 text-center">
              <p className="text-sm font-medium text-gray-500">
                Sitters earn{" "}
                <span className="font-bold text-amber-600">$20-30/hr</span>
              </p>
              <div className="mt-3 flex items-end justify-center gap-2">
                <span className="text-4xl font-extrabold text-gray-800">
                  $80
                </span>
                <span className="text-lg text-gray-500">–</span>
                <span className="text-4xl font-extrabold text-gray-800">
                  $120
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                for a typical 4-hour booking
              </p>
            </div>

            <div className="space-y-2 rounded-xl bg-white p-4">
              <h4 className="text-sm font-semibold text-gray-700">
                Estimated weekly earnings
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Part-time (10 hrs/wk)</span>
                  <span className="font-semibold text-gray-800">
                    $200 – $300
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Full-time (30 hrs/wk)</span>
                  <span className="font-semibold text-gray-800">
                    $600 – $900
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Super sitter (45 hrs/wk)</span>
                  <span className="font-semibold text-gray-800">
                    $900 – $1,350
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">✅</span>
                <h4 className="font-semibold text-gray-800">
                  Verified sitters earn more
                </h4>
              </div>
              <p className="text-sm text-gray-600">
                Sitters with a verified badge get up to{" "}
                <span className="font-bold text-blue-600">2x more bookings</span>{" "}
                because owners trust them more. For a one-time $25 fee, it pays
                for itself with your first extra booking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-amber-50 py-12">
        <div className="page-container">
          <h2 className="section-title mb-8 text-center text-2xl">
            What our sitters say
          </h2>
          <div className="grid gap-4">
            {testimonials.map((t, i) => (
              <div key={i} className="card">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-xl">
                    {t.emoji}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{t.name}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, j) => (
                        <span key={j} className="text-xs text-amber-400">
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm italic text-gray-600">"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-12">
        <div className="page-container">
          <h2 className="section-title mb-8 text-center text-2xl">
            Frequently asked questions
          </h2>
          <div className="grid gap-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className={`card cursor-pointer transition-colors hover:border-amber-300 ${
                  openFaq === i ? "border-amber-400 bg-amber-50/50" : ""
                }`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {faq.q}
                  </h3>
                  <span
                    className={`flex-shrink-0 text-sm text-amber-500 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </div>
                {openFaq === i && (
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gradient-to-t from-amber-100 to-white py-12">
        <div className="page-container text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-200 text-4xl">
            🦴
          </div>
          <h2 className="mb-3 text-2xl font-bold text-gray-800">
            Ready to start?
          </h2>
          <p className="mb-6 text-gray-500">
            Create your free sitter profile and start earning today.
          </p>
          <button
            onClick={() => navigate("/signup?role=sitter")}
            className="btn-primary px-10 py-4 text-lg shadow-lg shadow-amber-500/25"
          >
            Create your free sitter profile →
          </button>
          <p className="mt-4 text-xs text-gray-400">
            No fees to create a profile. You only pay when you get booked.
          </p>
        </div>
      </section>
    </div>
  );
}
