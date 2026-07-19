import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getActivity, getDogs } from "../data/api";
import { useAuth } from "../components/AuthContext";
import type {
  ActivityEntry,
  ActivityCareLogEntry,
  ActivityVideoEntry,
  ActivityStats,
  Dog,
} from "../types";

function dogEmoji(breed: string): string {
  const b = (breed || "").toLowerCase();
  if (b.includes("golden") || b.includes("retriever")) return "🦮";
  if (b.includes("poodle") || b.includes("pug")) return "🐩";
  if (b.includes("lab") || b.includes("labrador")) return "🐕‍🦺";
  if (b.includes("husky") || b.includes("shepherd")) return "🐺";
  if (b.includes("bulldog") || b.includes("boxer")) return "🐶";
  return "🐾";
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remain = sec % 60;
  return remain > 0 ? `${mins}:${String(remain).padStart(2, "0")}` : `${mins}m`;
}

function activityEmoji(type: string): string {
  switch (type) {
    case "feeding":
      return "🍖";
    case "water":
      return "💧";
    case "treats":
      return "🦴";
    case "playtime":
      return "🎾";
    case "video":
      return "📹";
    default:
      return "📋";
  }
}

function activityLabel(type: string): string {
  switch (type) {
    case "feeding":
      return "Feeding";
    case "water":
      return "Water changed";
    case "treats":
      return "Treats";
    case "playtime":
      return "Playtime";
    case "video":
      return "Video";
    default:
      return "Activity";
  }
}

function getCareLogActivities(entry: ActivityCareLogEntry): string[] {
  const activities: string[] = [];
  if (entry.feeding) activities.push("feeding");
  if (entry.waterChanged) activities.push("water");
  if (entry.treats) activities.push("treats");
  if (entry.playtimeMinutes > 0) activities.push("playtime");
  return activities;
}

export default function ActivityLog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    walksThisWeek: 0,
    feedingStreak: 0,
    lastVideo: null,
  });
  const [loading, setLoading] = useState(true);
  const [dogs, setDogs] = useState<Dog[]>([]);

  // Filter state from URL
  const dogIdFilter = searchParams.get("dog_id") || "";
  const typeFilter = searchParams.get("type") || "";
  const fromFilter = searchParams.get("from") || "";
  const toFilter = searchParams.get("to") || "";

  // Video modal state
  const [playingVideo, setPlayingVideo] = useState<ActivityVideoEntry | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params: any = {};
      if (dogIdFilter) params.dog_id = dogIdFilter;
      if (typeFilter) params.type = typeFilter;
      if (fromFilter) params.from = fromFilter;
      if (toFilter) params.to = toFilter;

      const [data, dogData] = await Promise.all([
        getActivity(Object.keys(params).length > 0 ? params : undefined),
        getDogs(),
      ]);
      setEntries(data.entries);
      setStats(data.stats);
      setDogs(dogData);
    } catch {
      setEntries([]);
      setDogs([]);
    } finally {
      setLoading(false);
    }
  }, [dogIdFilter, typeFilter, fromFilter, toFilter]);

  useEffect(() => {
    if (user && user.role === "owner") {
      setLoading(true);
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user, fetchData]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });

  const hasFilters = dogIdFilter || typeFilter || fromFilter || toFilter;

  // ── Unauthenticated ──
  if (!user) {
    return (
      <div className="page-container text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
          🔒
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">
          Sign in to view activity
        </h2>
        <p className="mb-6 text-gray-500">
          Track all care updates, videos, and activities in one place.
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
        <h2 className="mb-2 text-xl font-bold text-gray-800">
          Owner access only
        </h2>
        <p className="mb-6 text-gray-500">
          The activity feed is available for dog owners.
        </p>
        <button onClick={() => navigate("/")} className="btn-secondary">
          Back to Home
        </button>
      </div>
    );
  }

  // ── Group entries by dog ──
  const groupedEntries = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const e of entries) {
      const key = e.dogName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [entries]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <span>📊</span> Activity
        </h2>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="card text-center py-3">
          <p className="text-2xl mb-0.5">🎾</p>
          <p className="text-lg font-bold text-amber-600">
            {stats.walksThisWeek}
          </p>
          <p className="text-[10px] text-gray-400 uppercase font-semibold">
            Play mins this wk
          </p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl mb-0.5">🍖</p>
          <p className="text-lg font-bold text-amber-600">
            {stats.feedingStreak}
          </p>
          <p className="text-[10px] text-gray-400 uppercase font-semibold">
            Day feed streak
          </p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl mb-0.5">
            {stats.lastVideo ? "📹" : "—"}
          </p>
          <p className="text-lg font-bold text-amber-600">
            {stats.lastVideo
              ? formatTimestamp(stats.lastVideo.timestamp)
              : "None"}
          </p>
          <p className="text-[10px] text-gray-400 uppercase font-semibold truncate">
            Last video
          </p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="mb-4 space-y-2">
        {/* Dog filter */}
        <div className="flex items-center gap-2">
          <select
            value={dogIdFilter}
            onChange={(e) => setFilter("dog_id", e.target.value)}
            className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">🐾 All Dogs</option>
            {dogs.map((d) => (
              <option key={d.id} value={d.id}>
                {dogEmoji(d.breed)} {d.name}
              </option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setFilter("type", e.target.value)}
            className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">📋 All Types</option>
            <option value="feeding">🍖 Feeding</option>
            <option value="water">💧 Water</option>
            <option value="treats">🦴 Treats</option>
            <option value="playtime">🎾 Playtime</option>
            <option value="videos">📹 Videos</option>
          </select>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFilter("from", e.target.value)}
            className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
            placeholder="From"
          />
          <input
            type="date"
            value={toFilter}
            onChange={(e) => setFilter("to", e.target.value)}
            className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
            placeholder="To"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-amber-600 underline hover:text-amber-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Timeline ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center text-gray-400">
            <span className="mb-2 block text-3xl animate-pulse">🐾</span>
            <p>Loading activity...</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="card text-center py-12">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
            📭
          </div>
          <h3 className="mb-2 text-lg font-bold text-gray-700">
            {hasFilters ? "No matching activity" : "No activity yet"}
          </h3>
          <p className="text-sm text-gray-500">
            {hasFilters
              ? "Try adjusting your filters."
              : "Once sitters start logging care for your dogs, it'll show up here."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedEntries.entries()).map(
            ([dogName, dogEntries]) => {
              const dogInfo = dogs.find((d) => d.name === dogName);
              const breed = dogEntries[0]?.dogBreed || "";
              return (
                <div key={dogName} className="space-y-2">
                  {/* Dog group header */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-lg">
                      {dogInfo?.photoUrl ? (
                        <img
                          src={dogInfo.photoUrl}
                          alt={dogName}
                          className="h-full w-full rounded-full object-cover"
                          onError={(e) => {
                            const el = e.target as HTMLImageElement;
                            el.style.display = "none";
                            if (el.parentElement) {
                              el.parentElement.textContent = dogEmoji(breed);
                            }
                          }}
                        />
                      ) : (
                        dogEmoji(breed)
                      )}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {dogName}
                      </p>
                      <p className="text-xs text-gray-400">{breed}</p>
                    </div>
                    <span className="ml-auto text-xs text-gray-400">
                      {dogEntries.length} update
                      {dogEntries.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Entries */}
                  {dogEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="card relative pl-12 transition-all hover:shadow-md"
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-3 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs">
                        {dogEmoji(breed)}
                      </div>

                      {/* Sitter + time */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">
                          {entry.sitterEmoji || "🐕"}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">
                          {entry.sitterName}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          · {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>

                      {/* Content */}
                      {entry.entryType === "video" ? (
                        <VideoCard
                          entry={entry}
                          onPlay={() => setPlayingVideo(entry)}
                        />
                      ) : (
                        <CareLogCard entry={entry} />
                      )}
                    </div>
                  ))}
                </div>
              );
            }
          )}
        </div>
      )}

      {/* ── Video fullscreen modal ── */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPlayingVideo(null)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white text-lg hover:bg-black/70"
            >
              ✕
            </button>
            <video
              src={`data:video/mp4;base64,${playingVideo.videoData}`}
              poster={
                playingVideo.thumbnail
                  ? `data:image/jpeg;base64,${playingVideo.thumbnail}`
                  : undefined
              }
              controls
              autoPlay
              className="w-full max-h-[80dvh] bg-black"
            />
            <div className="absolute bottom-3 left-3 right-3 text-white text-xs">
              <p className="font-semibold">
                {playingVideo.dogName} · {playingVideo.sitterName}
              </p>
              <p className="opacity-70">
                {formatTimestamp(playingVideo.timestamp)} ·{" "}
                {formatDuration(playingVideo.durationSeconds)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function VideoCard({
  entry,
  onPlay,
}: {
  entry: ActivityVideoEntry;
  onPlay: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      className="relative w-full rounded-xl overflow-hidden bg-gray-100 group"
    >
      {entry.thumbnail ? (
        <img
          src={`data:image/jpeg;base64,${entry.thumbnail}`}
          alt={`Video of ${entry.dogName}`}
          className="w-full aspect-video object-cover"
        />
      ) : (
        <div className="w-full aspect-video flex items-center justify-center bg-amber-50">
          <span className="text-4xl">📹</span>
        </div>
      )}
      {/* Play overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-2xl shadow-lg group-hover:scale-110 transition-transform">
          ▶
        </span>
      </div>
      {/* Duration badge */}
      <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs text-white">
        📹 {formatDuration(entry.durationSeconds)}
      </span>
    </button>
  );
}

function CareLogCard({ entry }: { entry: ActivityCareLogEntry }) {
  const activities = getCareLogActivities(entry);

  return (
    <div className="space-y-2">
      {/* Activity chips */}
      <div className="flex flex-wrap gap-1.5">
        {activities.map((act) => (
          <span
            key={act}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-100"
          >
            {activityEmoji(act)} {activityLabel(act)}
          </span>
        ))}
      </div>

      {/* Details */}
      {entry.feeding && entry.feedingNotes && (
        <p className="text-xs text-gray-600">
          <span className="font-semibold">🍖 Food:</span> {entry.feedingNotes}
        </p>
      )}
      {entry.treats && entry.treatNotes && (
        <p className="text-xs text-gray-600">
          <span className="font-semibold">🦴 Treats:</span>{" "}
          {entry.treatNotes}
        </p>
      )}
      {entry.playtimeMinutes > 0 && (
        <p className="text-xs text-gray-600">
          <span className="font-semibold">🎾 Playtime:</span>{" "}
          {entry.playtimeMinutes} min
          {entry.playtimeNotes ? ` — ${entry.playtimeNotes}` : ""}
        </p>
      )}

      {/* Booking link */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          window.location.href = `/booking/${entry.bookingId}`;
        }}
        className="text-[10px] text-amber-500 hover:text-amber-700 underline"
      >
        View booking →
      </button>
    </div>
  );
}
