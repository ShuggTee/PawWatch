import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import {
  submitVerification,
  getVerificationStatus,
  type VerificationStatus,
} from "../data/api";

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/eVq9AT7vc568bdOfLd2cg01";
const STEPS = ["Personal Info", "Experience", "References", "Consent & Pay"];

interface FormData {
  fullName: string;
  phone: string;
  address: string;
  yearsExperience: number;
  certifications: string;
  firstAidCertified: boolean;
  reference1Name: string;
  reference1Phone: string;
  reference1Relationship: string;
  reference2Name: string;
  reference2Phone: string;
  reference2Relationship: string;
  consent: boolean;
}

const initialFormData: FormData = {
  fullName: "",
  phone: "",
  address: "",
  yearsExperience: 0,
  certifications: "",
  firstAidCertified: false,
  reference1Name: "",
  reference1Phone: "",
  reference1Relationship: "",
  reference2Name: "",
  reference2Phone: "",
  reference2Relationship: "",
  consent: false,
};

export default function Verify() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "sitter") {
      setLoading(false);
      return;
    }
    getVerificationStatus()
      .then((s) => {
        setStatus(s);
        // Pre-fill name from user account
        if (!s.application && !s.isVerified) {
          setFormData((prev) => ({ ...prev, fullName: user.name }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const update = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    // Validate current step
    if (step === 0) {
      if (!formData.fullName.trim() || !formData.phone.trim() || !formData.address.trim()) {
        setError("Please fill in all personal info fields.");
        return;
      }
    }
    if (step === 1) {
      // experience step is optional
    }
    if (step === 2) {
      if (!formData.reference1Name.trim() || !formData.reference1Phone.trim()) {
        setError("Please provide at least one reference with name and phone.");
        return;
      }
    }
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prevStep = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  };

  const handlePayment = () => {
    window.open(STRIPE_PAYMENT_LINK, "_blank");
    setPaid(true);
  };

  const handleSubmit = async () => {
    if (!formData.consent) {
      setError("You must consent to the background check to proceed.");
      return;
    }
    if (!paid) {
      setError("Please complete the $25 payment before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const app = await submitVerification(formData);
      setStatus({
        isVerified: false,
        pendingVerification: true,
        application: app,
      });
    } catch (err: any) {
      setError(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Not logged in or not a sitter ──
  if (!user) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🔒
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">Sign in required</h2>
        <p className="mb-6 text-gray-500">Sign in as a sitter to get verified.</p>
        <button onClick={() => navigate("/signin")} className="btn-primary">
          Sign In
        </button>
      </div>
    );
  }

  if (user.role !== "sitter") {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🐾
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">Sitter access only</h2>
        <p className="mb-6 text-gray-500">Only sitters can apply for verification.</p>
        <button onClick={() => navigate("/become-a-sitter")} className="btn-primary">
          Become a Sitter
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <div className="text-center text-gray-400">
          <span className="mb-2 block text-3xl animate-pulse">⏳</span>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // ── Already verified ──
  if (status?.isVerified) {
    return (
      <div className="page-container">
        <div className="card border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-amber-50 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-4xl">
            ✅
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">You're Verified!</h2>
          <p className="mb-4 text-gray-600">
            Your verified badge is active on your sitter profile. Owners trust
            verified sitters more — keep up the great work!
          </p>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2">
            <span className="text-lg">✅</span>
            <span className="font-semibold text-blue-700">Verified Sitter</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Pending review ──
  if (status?.pendingVerification && status.application?.status === "pending") {
    return (
      <div className="page-container">
        <div className="card border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
            ⏳
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">Pending Review</h2>
          <p className="mb-2 text-gray-600">
            Your verification application has been submitted and is currently under review.
          </p>
          <p className="mb-4 text-sm text-gray-400">
            Estimated timeline: 2-3 business days. We'll update your status once the review is complete.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2">
            <span className="text-lg">⏳</span>
            <span className="font-semibold text-amber-700">Pending Review</span>
          </div>
          {status.application && (
            <div className="mt-6 text-left text-sm text-gray-500 border-t border-amber-200 pt-4">
              <p className="font-semibold text-gray-700 mb-1">Application Summary:</p>
              <p>Name: {status.application.fullName}</p>
              <p>Submitted: {new Date(status.application.createdAt).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Rejected ──
  if (status?.application?.status === "rejected") {
    return (
      <div className="page-container">
        <div className="card border-2 border-red-200 bg-gradient-to-br from-red-50 to-white text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl">
            ❌
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">Application Not Approved</h2>
          <p className="mb-4 text-gray-600">
            Unfortunately, your verification application was not approved at this time.
            {status.application.reviewNotes && (
              <span className="block mt-2 text-sm italic">"{status.application.reviewNotes}"</span>
            )}
          </p>
          <button
            onClick={() => {
              setStatus(null);
              setFormData(initialFormData);
              setStep(0);
              setPaid(false);
            }}
            className="btn-primary"
          >
            Apply Again
          </button>
        </div>
      </div>
    );
  }

  // ── Multi-step form ──
  return (
    <div className="page-container">
      <h2 className="section-title flex items-center gap-2 mb-2">
        <span>✅</span> Sitter Verification
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Get verified to earn your blue badge and stand out to owners. One-time $25 fee.
      </p>

      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  i < step
                    ? "bg-blue-500 text-white"
                    : i === step
                    ? "bg-blue-500 text-white ring-2 ring-blue-300"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 w-6 sm:w-10 transition-colors ${
                    i < step ? "bg-blue-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-xs font-medium text-gray-500">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 0: Personal Info */}
      {step === 0 && (
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              className="input-field"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="input-field"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Address *
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => update("address", e.target.value)}
              className="input-field"
              placeholder="123 Main St, City, State ZIP"
            />
          </div>
        </div>
      )}

      {/* Step 1: Experience */}
      {step === 1 && (
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Years of Experience
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={formData.yearsExperience}
              onChange={(e) => update("yearsExperience", parseInt(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Certifications
            </label>
            <textarea
              value={formData.certifications}
              onChange={(e) => update("certifications", e.target.value)}
              className="input-field min-h-[80px]"
              placeholder="e.g. Pet CPR Certified, Dog Training Level 2, Vet Tech degree..."
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.firstAidCertified}
              onChange={(e) => update("firstAidCertified", e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              I am pet first-aid certified 🩺
            </span>
          </label>
        </div>
      )}

      {/* Step 2: References */}
      {step === 2 && (
        <div className="card space-y-4">
          <p className="text-sm text-gray-500 mb-2">
            Please provide two references who can vouch for your pet care experience.
          </p>

          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-bold text-gray-600">Reference 1 *</h4>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={formData.reference1Name}
                onChange={(e) => update("reference1Name", e.target.value)}
                className="input-field"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone *</label>
              <input
                type="tel"
                value={formData.reference1Phone}
                onChange={(e) => update("reference1Phone", e.target.value)}
                className="input-field"
                placeholder="(555) 987-6543"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Relationship</label>
              <input
                type="text"
                value={formData.reference1Relationship}
                onChange={(e) => update("reference1Relationship", e.target.value)}
                className="input-field"
                placeholder="Former client, colleague, etc."
              />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-bold text-gray-600">Reference 2</h4>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={formData.reference2Name}
                onChange={(e) => update("reference2Name", e.target.value)}
                className="input-field"
                placeholder="Bob Johnson"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.reference2Phone}
                onChange={(e) => update("reference2Phone", e.target.value)}
                className="input-field"
                placeholder="(555) 456-7890"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Relationship</label>
              <input
                type="text"
                value={formData.reference2Relationship}
                onChange={(e) => update("reference2Relationship", e.target.value)}
                className="input-field"
                placeholder="Former client, colleague, etc."
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Consent & Pay */}
      {step === 3 && (
        <div className="card space-y-4">
          {/* Payment */}
          <div className={`rounded-lg border-2 p-4 ${paid ? "border-green-300 bg-green-50" : "border-blue-200 bg-blue-50"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">💳</span>
              <h4 className="font-bold text-gray-800">Verification Fee — $25</h4>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              A one-time fee covers your background check and identity verification.
            </p>
            {!paid ? (
              <button
                type="button"
                onClick={handlePayment}
                className="btn-primary w-full"
              >
                Pay $25 via Stripe →
              </button>
            ) : (
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                <span>✅</span> Payment completed
              </div>
            )}
            {paid && (
              <p className="mt-2 text-xs text-gray-500">
                After completing payment on Stripe, return here to submit your application.
              </p>
            )}
          </div>

          {/* Consent */}
          <div className="rounded-lg border border-gray-200 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.consent}
                onChange={(e) => update("consent", e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  I consent to a background check *
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  By checking this box, you authorize PawWatch to conduct a background check that
                  may include identity verification, criminal history, and sex offender registry
                  checks. Your information is handled securely and used solely for verification purposes.
                  You may request a copy of your background check report at any time.
                </p>
              </div>
            </label>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !formData.consent || !paid}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit for Review ($25)"}
          </button>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between">
        {step > 0 ? (
          <button onClick={prevStep} className="btn-secondary">
            ← Back
          </button>
        ) : (
          <div />
        )}
        {step < STEPS.length - 1 && (
          <button onClick={nextStep} className="btn-primary">
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
