import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSitter, createBooking } from "../data/api";
import { useAuth } from "../components/AuthContext";
import type { Sitter } from "../types";

export default function Book() {
  const { sitterId } = useParams<{ sitterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sitter, setSitter] = useState<Sitter | null>(null);
  const [loadingSitter, setLoadingSitter] = useState(true);

  const [form, setForm] = useState({
    dogName: "",
    dogBreed: "",
    address: "",
    date: "",
    startTime: "",
    endTime: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sitterId) {
      getSitter(sitterId)
        .then(setSitter)
        .catch(() => setSitter(null))
        .finally(() => setLoadingSitter(false));
    }
  }, [sitterId]);

  if (!user) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🔒
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">
          Sign in to book
        </h2>
        <p className="mb-6 text-gray-500">
          Create an account or sign in to book a sitter.
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

  if (user.role !== "owner") {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🐕
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">
          Sitters can&apos;t book
        </h2>
        <p className="mb-6 text-gray-500">
          Switch to an owner account to book sitters.
        </p>
        <button onClick={() => navigate("/sitters")} className="btn-secondary">
          Browse Sitters
        </button>
      </div>
    );
  }

  if (loadingSitter) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <div className="text-center text-gray-400">
          <span className="mb-2 block text-3xl animate-pulse">🐾</span>
          <p>Loading sitter...</p>
        </div>
      </div>
    );
  }

  if (!sitter) {
    return (
      <div className="page-container text-center">
        <p className="text-gray-500">Sitter not found.</p>
        <button
          onClick={() => navigate("/sitters")}
          className="btn-secondary mt-4"
        >
          Back to sitters
        </button>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await createBooking({
        sitterId: sitter.id,
        dogName: form.dogName,
        dogBreed: form.dogBreed,
        address: form.address,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to create booking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
          ✅
        </div>
        <h2 className="mb-2 text-2xl font-bold text-gray-800">
          Booking Confirmed!
        </h2>
        <p className="mb-6 text-gray-500">
          {sitter.name} will take care of {form.dogName || "your pup"} on{" "}
          {form.date} from {form.startTime} to {form.endTime}.
        </p>
        <div className="grid gap-3">
          <button onClick={() => navigate(`/bookings`)} className="btn-primary">
            View My Bookings
          </button>
          <button
            onClick={() => navigate("/sitters")}
            className="btn-secondary"
          >
            Book Another Sitter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
      >
        ← Back
      </button>

      {/* Sitter summary */}
      <div className="card mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
          {sitter.emoji}
        </div>
        <div>
          <h2 className="font-semibold text-gray-800 flex items-center gap-1.5">
            {sitter.name}
            {sitter.isVerified && (
              <span className="text-sm" title="Verified Sitter">
                ✅
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500">
            ⭐ {sitter.rating} · ${sitter.pricePerHour}/hr
          </p>
        </div>
      </div>

      {/* Booking form */}
      <form onSubmit={handleSubmit} className="card">
        <h3 className="section-title">Booking Details</h3>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="input-row">
          <label htmlFor="ownerName">Your Name</label>
          <input
            id="ownerName"
            value={user.name}
            disabled
            className="bg-gray-50 text-gray-600"
          />
        </div>

        <div className="input-row">
          <label htmlFor="dogName">Dog&apos;s Name</label>
          <input
            id="dogName"
            name="dogName"
            required
            placeholder="Buddy"
            value={form.dogName}
            onChange={handleChange}
          />
        </div>

        <div className="input-row">
          <label htmlFor="dogBreed">Dog&apos;s Breed</label>
          <input
            id="dogBreed"
            name="dogBreed"
            placeholder="Golden Retriever"
            value={form.dogBreed}
            onChange={handleChange}
          />
        </div>

        <div className="input-row">
          <label htmlFor="address">Your Home Address</label>
          <input
            id="address"
            name="address"
            required
            placeholder="123 Main St, City"
            value={form.address}
            onChange={handleChange}
          />
          <p className="mt-1 text-xs text-gray-400">
            Used for sitter GPS arrival detection.
          </p>
        </div>

        <div className="input-row">
          <label htmlFor="date">Date</label>
          <input
            id="date"
            name="date"
            type="date"
            required
            value={form.date}
            onChange={handleChange}
            min={new Date().toISOString().split("T")[0]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="input-row">
            <label htmlFor="startTime">Start Time</label>
            <input
              id="startTime"
              name="startTime"
              type="time"
              required
              value={form.startTime}
              onChange={handleChange}
            />
          </div>
          <div className="input-row">
            <label htmlFor="endTime">End Time</label>
            <input
              id="endTime"
              name="endTime"
              type="time"
              required
              value={form.endTime}
              onChange={handleChange}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary mt-2 w-full"
        >
          {submitting
            ? "Booking..."
            : `Confirm Booking — $${sitter.pricePerHour}/hr`}
        </button>
      </form>
    </div>
  );
}
