import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapSitter {
  lat: number;
  lng: number;
  name?: string;
  emoji?: string;
  distance?: number | null;
  arrived?: boolean;
  status?: string;
  dogName?: string;
}

interface LeafletMapProps {
  sitters: MapSitter[];
  homePosition: { lat: number; lng: number };
  /** Whether the primary sitter is actively tracking (pulsing animation) */
  tracking?: boolean;
  /** Show the home marker and arrival radius */
  showHome?: boolean;
  /** Full-screen mode (taller) */
  fullScreen?: boolean;
  /** Called when a sitter marker is clicked */
  onSitterClick?: (sitter: MapSitter) => void;
  /** Center on primary sitter position */
  centerOnSitter?: boolean;
  /** Fallback to coordinates-only if Leaflet fails */
  fallbackContent?: React.ReactNode;
}

export default function LeafletMap({
  sitters,
  homePosition,
  tracking = false,
  showHome = true,
  fullScreen = false,
  onSitterClick,
  centerOnSitter = false,
  fallbackContent,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const circleRef = useRef<L.Circle | null>(null);
  const homeMarkerRef = useRef<L.Marker | null>(null);
  const [mapError, setMapError] = useState(false);
  const initDone = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || initDone.current) return;

    try {
      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
        tap: true,
      }).setView([homePosition.lat, homePosition.lng], 14);

      // Warm/light tile layer (CartoDB Positron)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        }
      ).addTo(map);

      mapInstance.current = map;
      initDone.current = true;
    } catch {
      setMapError(true);
    }

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
      initDone.current = false;
    };
  }, [homePosition.lat, homePosition.lng]);

  // Add/update home marker and circle
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !showHome) return;

    try {
      // Remove old home marker
      if (homeMarkerRef.current) {
        map.removeLayer(homeMarkerRef.current);
        homeMarkerRef.current = null;
      }

      // Remove old circle
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }

      // Home marker
      const homeIcon = L.divIcon({
        html: '<div style="font-size:28px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3))">🏠</div>',
        className: "leaflet-custom-marker",
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      homeMarkerRef.current = L.marker(
        [homePosition.lat, homePosition.lng],
        { icon: homeIcon }
      )
        .addTo(map)
        .bindPopup("🏠 Your Home");

      // Check if any sitter has arrived
      const anyArrived = sitters.some((s) => s.arrived);

      // Arrival radius circle
      circleRef.current = L.circle(
        [homePosition.lat, homePosition.lng],
        {
          radius: 100,
          color: anyArrived ? "#16a34a" : "#d97706",
          fillColor: anyArrived ? "#16a34a" : "#f59e0b",
          fillOpacity: 0.12,
          weight: 2,
          dashArray: anyArrived ? undefined : "6 3",
        }
      ).addTo(map);
    } catch {
      // Silently handle Leaflet errors
    }
  }, [showHome, homePosition.lat, homePosition.lng, sitters]);

  // Update sitter markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    try {
      // Clear old markers
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];

      const bounds = L.latLngBounds([]);
      let hasBounds = false;

      sitters.forEach((sitter) => {
        const isArrived = sitter.arrived ?? false;
        const color = isArrived ? "#16a34a" : "#d97706";

        // Pulsing animation for actively tracking sitter
        const pulseAnimation = tracking ? "sitter-marker-pulse" : "";

        const sitterIcon = L.divIcon({
          html: `<div class="${pulseAnimation}" style="
            width: 18px; height: 18px; 
            background: ${color}; 
            border-radius: 50%; 
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            transition: background 0.3s;
          "></div>`,
          className: "leaflet-custom-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([sitter.lat, sitter.lng], {
          icon: sitterIcon,
        });

        // Popup content
        const distText =
          sitter.distance != null ? `${sitter.distance}m away` : "";
        const statusEmoji =
          sitter.arrived ? "✅ Arrived!" :
          sitter.status === "in-progress" ? "📍 En route" :
          sitter.status === "confirmed" ? "📋 Confirmed" : "";
        const popupHtml = [
          `<div style="font-family:system-ui;min-width:140px">`,
          sitter.name
            ? `<strong>${sitter.emoji || "🐾"} ${sitter.name}</strong>`
            : "",
          sitter.dogName ? `<br><small>🐕 ${sitter.dogName}</small>` : "",
          distText ? `<br><small>📍 ${distText}</small>` : "",
          statusEmoji ? `<br><small>${statusEmoji}</small>` : "",
          `</div>`,
        ]
          .filter(Boolean)
          .join("");

        if (popupHtml) {
          marker.bindPopup(popupHtml, { offset: [0, -8] });
        }

        marker.addTo(map);

        // Click handler for track page callbacks
        if (onSitterClick) {
          marker.on("click", () => onSitterClick(sitter));
        }

        markersRef.current.push(marker);
        bounds.extend([sitter.lat, sitter.lng]);
        hasBounds = true;
      });

      // Add home to bounds
      if (showHome) {
        bounds.extend([homePosition.lat, homePosition.lng]);
        hasBounds = true;
      }

      // Auto-fit bounds or center on sitter
      if (hasBounds && !centerOnSitter) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else if (centerOnSitter && sitters.length > 0) {
        const primary = sitters[0];
        map.setView([primary.lat, primary.lng], map.getZoom() || 15);
      }
    } catch {
      // Silently handle
    }
  }, [sitters, tracking, showHome, centerOnSitter, homePosition, onSitterClick]);

  // Show fallback if Leaflet fails
  if (mapError) {
    if (fallbackContent) {
      return <>{fallbackContent}</>;
    }
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-amber-50/50 py-8 text-gray-400">
        <span className="mb-2 text-3xl">📍</span>
        <p className="text-sm">Map unavailable. Showing coordinates:</p>
        {sitters.map((s, i) => (
          <div key={i} className="mt-2 font-mono text-xs text-gray-500">
            {s.name && <span className="mr-2">{s.name}:</span>}
            {s.lat.toFixed(6)}, {s.lng.toFixed(6)}
            {s.distance != null && (
              <span className="ml-2 text-amber-600">({s.distance}m)</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  const height = fullScreen ? "calc(100dvh - 180px)" : "280px";

  return (
    <div
      ref={mapRef}
      style={{ height, width: "100%", minHeight: "200px" }}
      className="leaflet-map-container rounded-xl overflow-hidden border border-amber-100"
    />
  );
}
