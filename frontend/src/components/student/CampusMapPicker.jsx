import React, { useRef, useState } from 'react';
import { Crosshair, MapPin, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

const DEFAULT_CENTER_LAT = Number(import.meta.env.VITE_CAMPUS_LAT) || 28.545;
const DEFAULT_CENTER_LNG = Number(import.meta.env.VITE_CAMPUS_LNG) || 77.1926;
const CAMPUS_SPAN = 0.008; // ~800m campus bounding box

export const DEFAULT_CAMPUS_PIN = {
  x: 50,
  y: 50,
  lat: Number(DEFAULT_CENTER_LAT.toFixed(5)),
  lng: Number(DEFAULT_CENTER_LNG.toFixed(5)),
  label: 'Campus Center',
  source: 'default',
};

const clampX = (value) => Math.min(92, Math.max(8, value));
const clampY = (value) => Math.min(92, Math.max(22, value));

const toCoords = (xPct, yPct) => {
  const lat = DEFAULT_CENTER_LAT + ((50 - yPct) / 100) * CAMPUS_SPAN;
  const lng = DEFAULT_CENTER_LNG + ((xPct - 50) / 100) * CAMPUS_SPAN;
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  };
};

const toPercent = (lat, lng) => {
  const rawX = 50 + ((lng - DEFAULT_CENTER_LNG) / CAMPUS_SPAN) * 100;
  const rawY = 50 - ((lat - DEFAULT_CENTER_LAT) / CAMPUS_SPAN) * 100;
  const outsideCampus = rawX < 4 || rawX > 96 || rawY < 4 || rawY > 96;
  return {
    x: clampX(rawX),
    y: clampY(rawY),
    outsideCampus,
  };
};

export const CampusMapPicker = ({ pin, onPinChange }) => {
  const mapRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const activePin = pin || DEFAULT_CAMPUS_PIN;

  const handleMapClick = (event) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xPct = clampX(((event.clientX - rect.left) / rect.width) * 100);
    const yPct = clampY(((event.clientY - rect.top) / rect.height) * 100);
    const coords = toCoords(xPct, yPct);
    setGeoError('');
    onPinChange?.({
      x: xPct,
      y: yPct,
      ...coords,
      label: 'Pinned spot',
      source: 'map',
      outsideCampus: false,
    });
  };

  const handleUseCurrentLocation = (event) => {
    event.stopPropagation();
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(5));
        const lng = Number(position.coords.longitude.toFixed(5));
        const pos = toPercent(lat, lng);
        onPinChange?.({
          x: pos.x,
          y: pos.y,
          lat,
          lng,
          label: 'Current GPS',
          source: 'gps',
          outsideCampus: pos.outsideCampus,
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission denied. Click on the map to move the pin manually.');
        } else {
          setGeoError('Unable to detect current location. Click on the map to move the pin.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleResetPin = (event) => {
    event.stopPropagation();
    setGeoError('');
    onPinChange?.(DEFAULT_CAMPUS_PIN);
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-gray-600">
          <span className="font-semibold text-gray-800">Campus Map</span> · Click anywhere on the
          map to move the pin
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={handleUseCurrentLocation}
            disabled={locating}
          >
            <Crosshair className="mr-1 h-3 w-3 text-emerald-600" />
            {locating ? 'Locating...' : 'Use Current Location'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-gray-600 hover:text-gray-900"
            onClick={handleResetPin}
            disabled={activePin.source === 'default'}
            title="Reset Pin to Campus Center"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset Pin
          </Button>
        </div>
      </div>

      {/* Clean Interactive Campus Grid Map */}
      <div
        ref={mapRef}
        onClick={handleMapClick}
        role="application"
        aria-label="Interactive campus map picker"
        className="relative h-52 w-full cursor-crosshair overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-emerald-50/60 via-slate-50 to-sky-50/50 select-none"
      >
        {/* Subtle grid lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Campus pathways */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-white/80" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-white/80" />

        {/* Always-Visible Pin Marker */}
        <div
          style={{
            left: `${clampX(Number(activePin.x) || 50)}%`,
            top: `${clampY(Number(activePin.y) || 50)}%`,
          }}
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full transition-all duration-150"
        >
          <div className="relative flex flex-col items-center">
            <span className="absolute -inset-1 rounded-full bg-emerald-400/45 animate-ping" />
            <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-2 ring-white">
              <MapPin className="h-4 w-4" />
            </div>
            <span className="mt-0.5 whitespace-nowrap rounded bg-gray-900/90 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
              {activePin.label || 'Pin'}
            </span>
          </div>
        </div>
      </div>

      {geoError && <p className="text-[11px] font-medium text-amber-700">{geoError}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600">
        <span>
          Pinned coordinates:{' '}
          <span className="font-mono font-semibold text-gray-800">
            {activePin.lat}, {activePin.lng}
          </span>
          {activePin.outsideCampus && (
            <span className="ml-2 text-amber-700">
              · Pinned to GPS coordinates (outside local campus grid)
            </span>
          )}
        </span>
        <span className="text-gray-400">Location text remains editable above</span>
      </div>
    </div>
  );
};
