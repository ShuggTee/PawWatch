import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../components/AuthContext";

export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup } = useAuth();
  const preselectedRole = (searchParams.get("role") === "sitter" ? "sitter" : "owner") as "owner" | "sitter";
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: preselectedRole,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup(form.email, form.password, form.name, form.role);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Sign up failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="mx-auto max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
            🐾
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Join PawWatch</h1>
          <p className="text-gray-500">Create your account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="card">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="input-row">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Jane Smith"
              value={form.name}
              onChange={handleChange}
            />
          </div>

          <div className="input-row">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div className="input-row">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="At least 6 characters"
              minLength={6}
              value={form.password}
              onChange={handleChange}
            />
          </div>

          <div className="input-row">
            <label htmlFor="role">I want to...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, role: "owner" }))}
                className={`rounded-xl border-2 px-4 py-3 text-center font-semibold transition-all ${
                  form.role === "owner"
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-amber-300"
                }`}
              >
                <span className="block text-2xl">👤</span>
                <span className="text-sm">Find Sitters</span>
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, role: "sitter" }))}
                className={`rounded-xl border-2 px-4 py-3 text-center font-semibold transition-all ${
                  form.role === "sitter"
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-amber-300"
                }`}
              >
                <span className="block text-2xl">🐕</span>
                <span className="text-sm">Be a Sitter</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/signin" className="font-semibold text-amber-600 hover:text-amber-700">
              Sign In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
