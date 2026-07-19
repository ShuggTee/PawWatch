import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSitter, createBooking, getDogs } from "../data/api";
import { useAuth } from "../components/AuthContext";
import Calendar from "../components/Calendar";
import type { Sitter, Dog } from "../types";

const TIME_SLOTS = [
  { label: "Morning", sub: "8 AM – 12 PM", start: "08:00", end: "12:00" },
  { label: "Afternoon", sub: "12 PM – 4 PM", start: "12:00", end: "16:00" },
  { label: "Evening", sub: "4 PM – 8 PM", start: "16:00", end: "20:00" },
  { label: "Custom", sub: "Choose your own times", start: "", end: "" },
];

export default function Book() {
  const { sitterId } = useParams<{ sitterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sitter, setSitter] = useState<Sitter | null>(null);
  const [loadingSitter, setLoadingSitter] = useState(true);
  const [savedDogs, setSavedDogs] = useState<Dog[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string>("");

  const [form, setForm] = useState({
    dogName: "",
    dogBreed: "",
    address: "",
    date: "",
    startTime: "",
    endTime: "",
  });
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
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

  // Fetch saved dogs for the dropdown
  useEffect(() => {
    if (user && user.role === "owner") {
      getDogs()
        .then(setSavedDogs)
        .catch(() => setSavedDogs([]));
    }
  }, [user]);

  // When a saved dog is selected, pre-fill the form
  const handleDogSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dogId = e.target.value;
    setSelectedDogId(dogId);

    if (dogId === "new") {
      // User wants to add a new dog — redirect to dogs page
      navigate("/dogs");
      return;
    }

    if (!dogId) {
      // "Select a dog" placeholder — clear dog fields
      setForm((prev) => ({ ...prev, dogName: "", dogBreed: "" }));
      return;
    }

    const dog = savedDogs.find((d) => d.id === dogId);
    if (dog) {
      setForm((prev) => ({
        ...prev,
        dogName: dog.name,
        dogBreed: dog.breed,
      }));
    }
  };

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

  const handleSlotSelect = (idx: number) => {
    setSelectedSlot(idx);
    const slot = TIME_SLOTS[idx];
    if (slot.start && slot.end) {
      // Pre-filled slot
      setForm((prev) => ({ ...prev, startTime: slot.start, endTime: slot.end }));
    } else {
      // Custom — clear times for manual entry
      setForm((prev) => ({ ...prev, startTime: "", endTime: "" }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    // If user manually edits dog fields, clear the dropdown selection
    if (e.target.name === "dogName" || e.target.name === "dogBreed") {
      setSelectedDogId("");
    }
    // If user manually edits time, switch to custom slot
    if (e.target.name === "startTime" || e.target.name === "endTime") {
      setSelectedSlot(3); // "Custom" is index 3
    }
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

        {/* Saved dogs dropdown */}
        {savedDogs.length > 0 && (
          <div className="input-row">
            <label htmlFor="savedDog">Select a Dog</label>
            <select
              id="savedDog"
              value={selectedDogId}
              onChange={handleDogSelect}
              className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-base focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20fill%3D%22%23d97706%22%20d%3D%22M4.4%205.6L8%209.2l3.6-3.6%201.4%201.4-5%205-5-5z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.2rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
            >
              <option value="">— Select a dog —</option>
              {savedDogs.map((dog) => (
                <option key={dog.id} value={dog.id}>
                  {dog.name} {dog.breed ? `(${dog.breed})` : ""}
                </option>
              ))}
              <option value="new">+ Add New Dog</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Pick a saved profile or{" "}
              <button
                type="button"
                onClick={() => navigate("/dogs")}
                className="text-amber-600 underline hover:text-amber-700"
              >
                manage your dogs
              </button>.
            </p>
          </div>
        )}

        {/* Or add first dog */}
        {savedDogs.length === 0 && (
          <div className="card mb-4 border-2 border-dashed border-amber-300 bg-amber-50/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🐕</span>
              <h4 className="font-semibold text-gray-700 text-sm">Save time with dog profiles</h4>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Save your dog's details once and reuse them for every booking.
            </p>
            <button
              type="button"
              onClick={() => navigate("/dogs")}
              className="btn-primary btn-sm w-full"
            >
              Add a Dog Profile
            </button>
          </div>
        )}

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
          <label>Select Date</label>
          <Calendar
            sitterId={sitter.id}
            selectedDate={form.date || null}
            onSelectDate={(date) => setForm((prev) => ({ ...prev, date }))}
          />
          {form.date && (
            <p className="mt-2 text-center text-sm text-gray-500">
              📅 {new Date(form.date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>

        {form.date && (
          <div className="input-row">
            <label>Time Slot</label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((slot, idx) => (
                <button
                  key={slot.label}
                  type="button"
                  onClick={() => handleSlotSelect(idx)}
                  className={`
                    rounded-xl border-2 px-3 py-3 text-left transition-all active:scale-[0.97]
                    ${selectedSlot === idx
                      ? "border-amber-500 bg-amber-50 shadow-sm"
                      : "border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/50"
                    }
                  `}
                >
                  <div className="text-sm font-semibold text-gray-800">
                    {slot.label}
                  </div>
                  <div className="text-xs text-gray-500">{slot.sub}</div>
                </button>
              ))}
            </div>

            {/* Custom time inputs */}
            {selectedSlot === 3 && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="startTime" className="text-xs">Start Time</label>
                  <input
                    id="startTime"
                    name="startTime"
                    type="time"
                    required
                    value={form.startTime}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="endTime" className="text-xs">End Time</label>
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
            )}
          </div>
        )}

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
