import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getDogs, createDog, updateDog, deleteDog } from "../data/api";
import { useAuth } from "../components/AuthContext";
import type { Dog } from "../types";

const EMPTY_FORM = {
  name: "",
  breed: "",
  age: "",
  weight: "",
  photoUrl: "",
  bio: "",
  notes: "",
};

export default function Dogs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDog, setEditingDog] = useState<Dog | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchDogs = useCallback(async () => {
    try {
      const data = await getDogs();
      setDogs(data);
    } catch {
      setDogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role === "owner") {
      fetchDogs();
    } else {
      setLoading(false);
    }
  }, [user, fetchDogs]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingDog(null);
    setError("");
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (dog: Dog) => {
    setEditingDog(dog);
    setForm({
      name: dog.name,
      breed: dog.breed,
      age: String(dog.age || ""),
      weight: String(dog.weight || ""),
      photoUrl: dog.photoUrl,
      bio: dog.bio,
      notes: dog.notes,
    });
    setError("");
    setShowForm(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Dog name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        breed: form.breed.trim(),
        age: parseInt(form.age, 10) || 0,
        weight: parseFloat(form.weight) || 0,
        photoUrl: form.photoUrl.trim(),
        bio: form.bio.trim(),
        notes: form.notes.trim(),
      };

      if (editingDog) {
        await updateDog(editingDog.id, payload);
      } else {
        await createDog(payload);
      }
      await fetchDogs();
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || "Failed to save dog.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDog(id);
      setDogs((prev) => prev.filter((d) => d.id !== id));
      setDeleteConfirm(null);
      if (editingDog?.id === id) {
        setShowForm(false);
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete dog.");
    }
  };

  // ── Unauthenticated / wrong role ──
  if (!user) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🔒
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">Sign in to manage dogs</h2>
        <p className="mb-6 text-gray-500">
          Create an account or sign in to save dog profiles.
        </p>
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
          🐕
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">Owner access only</h2>
        <p className="mb-6 text-gray-500">
          Switch to an owner account to manage dog profiles.
        </p>
        <button onClick={() => navigate("/")} className="btn-secondary">
          Back to Home
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <div className="text-center text-gray-400">
          <span className="mb-2 block text-3xl animate-pulse">🐾</span>
          <p>Loading dogs...</p>
        </div>
      </div>
    );
  }

  // ── Dog emoji picker based on breed keywords ──
  const dogEmoji = (breed: string): string => {
    const b = breed.toLowerCase();
    if (b.includes("golden") || b.includes("retriever")) return "🦮";
    if (b.includes("poodle") || b.includes("pug")) return "🐩";
    if (b.includes("lab") || b.includes("labrador")) return "🐕‍🦺";
    if (b.includes("husky") || b.includes("shepherd")) return "🐺";
    if (b.includes("bulldog") || b.includes("boxer")) return "🐶";
    return "🐾";
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <span>🐕</span> My Dogs
        </h2>
        <button onClick={openNew} className="btn-primary btn-sm">
          + Add Dog
        </button>
      </div>

      {/* Dog grid */}
      {dogs.length === 0 && !showForm ? (
        <div className="card text-center py-12">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
            🐾
          </div>
          <h3 className="mb-2 text-lg font-bold text-gray-700">No dogs yet</h3>
          <p className="mb-6 text-sm text-gray-500">
            Save your dog's profile to speed up booking.
          </p>
          <button onClick={openNew} className="btn-primary">
            Add Your First Dog
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {dogs.map((dog) => (
            <button
              key={dog.id}
              onClick={() => openEdit(dog)}
              className="card flex gap-3 text-left transition-all hover:shadow-md active:scale-[0.98]"
            >
              {/* Photo / emoji */}
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-3xl overflow-hidden">
                {dog.photoUrl ? (
                  <img
                    src={dog.photoUrl}
                    alt={dog.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).parentElement!.dataset.fallback = "true";
                      (e.target as HTMLImageElement).parentElement!.textContent = dogEmoji(dog.breed);
                    }}
                  />
                ) : (
                  dogEmoji(dog.breed)
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-800 truncate">{dog.name}</h3>
                <p className="text-sm text-gray-500">
                  {dog.breed || "Mixed breed"}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {dog.age > 0 && `${dog.age} yr${dog.age !== 1 ? "s" : ""}`}
                  {dog.age > 0 && dog.weight > 0 && " · "}
                  {dog.weight > 0 && `${dog.weight} lbs`}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/activity?dog_id=${dog.id}`);
                  }}
                  className="mt-2 text-xs text-amber-600 hover:text-amber-800 font-medium underline"
                >
                  📊 View Activity →
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add/Edit form (modal-like panel) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40" onClick={() => { setShowForm(false); resetForm(); }}>
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingDog ? "Edit Dog" : "Add a Dog"}
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="input-row">
                <label htmlFor="name">Name *</label>
                <input
                  id="name"
                  name="name"
                  required
                  placeholder="Buddy"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>

              <div className="input-row">
                <label htmlFor="breed">Breed</label>
                <input
                  id="breed"
                  name="breed"
                  placeholder="Golden Retriever"
                  value={form.breed}
                  onChange={handleChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="input-row">
                  <label htmlFor="age">Age (years)</label>
                  <input
                    id="age"
                    name="age"
                    type="number"
                    min="0"
                    max="30"
                    placeholder="3"
                    value={form.age}
                    onChange={handleChange}
                  />
                </div>
                <div className="input-row">
                  <label htmlFor="weight">Weight (lbs)</label>
                  <input
                    id="weight"
                    name="weight"
                    type="number"
                    min="0"
                    max="300"
                    step="0.1"
                    placeholder="45"
                    value={form.weight}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="input-row">
                <label htmlFor="photoUrl">Photo URL</label>
                <input
                  id="photoUrl"
                  name="photoUrl"
                  type="url"
                  placeholder="https://example.com/dog.jpg"
                  value={form.photoUrl}
                  onChange={handleChange}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Paste a link to your dog's photo (optional).
                </p>
              </div>

              <div className="input-row">
                <label htmlFor="bio">About Me</label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={2}
                  placeholder="Friendly, loves belly rubs..."
                  value={form.bio}
                  onChange={handleChange}
                />
              </div>

              <div className="input-row">
                <label htmlFor="notes">Notes (medical, dietary, etc.)</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  placeholder="Allergic to chicken, takes meds at 8am..."
                  value={form.notes}
                  onChange={handleChange}
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? "Saving..." : editingDog ? "Save Changes" : "Add Dog"}
                </button>
                {editingDog && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(editingDog.id)}
                    className="btn-secondary flex-shrink-0 text-red-500 border-red-200 hover:bg-red-50"
                  >
                    🗑
                  </button>
                )}
              </div>
            </form>

            {/* Delete confirmation */}
            {deleteConfirm && (
              <div className="border-t border-amber-100 p-6 bg-red-50 rounded-b-2xl">
                <p className="text-sm font-semibold text-red-700 mb-2">
                  Delete this dog profile?
                </p>
                <p className="text-xs text-red-600 mb-3">
                  This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
