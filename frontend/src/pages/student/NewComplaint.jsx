import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { complaintApi } from '../../api/complaints';
import { uploadApi } from '../../api/upload';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Droplets,
  Hammer,
  Image as ImageIcon,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  Monitor,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import { CATEGORY_OPTIONS, getCategoryLabel } from '../../utils/categories';
import { CampusMapPicker, DEFAULT_CAMPUS_PIN } from '../../components/student/CampusMapPicker';

const CATEGORY_ICONS = {
  electrical: Zap,
  water: Droplets,
  furniture: Hammer,
  cleaning: Sparkles,
  internet: Wifi,
  classroom_equipment: Monitor,
  other: Wrench,
};

const PRIORITY_OPTIONS = [
  {
    value: 'low',
    label: 'Low',
    hint: 'No immediate impact',
    sla: '48h',
    activeClass: 'border-slate-400 bg-slate-50 text-slate-900 ring-1 ring-slate-300',
    badgeClass: 'bg-slate-100 text-slate-600',
    dotClass: 'bg-slate-400',
  },
  {
    value: 'medium',
    label: 'Medium',
    hint: 'Causes inconvenience',
    sla: '24h',
    activeClass: 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-500/30',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'high',
    label: 'High',
    hint: 'Disrupts activities',
    sla: '4h',
    activeClass: 'border-amber-500 bg-amber-50/70 text-amber-950 ring-1 ring-amber-500/30',
    badgeClass: 'bg-amber-100 text-amber-800',
    dotClass: 'bg-amber-500',
  },
  {
    value: 'critical',
    label: 'Critical',
    hint: 'Safety hazard',
    sla: 'Immediate',
    activeClass: 'border-red-500 bg-red-50/70 text-red-950 ring-1 ring-red-500/30',
    badgeClass: 'bg-red-100 text-red-700',
    dotClass: 'bg-red-500',
  },
];

const CAMPUS_ZONES = [
  'Hostel Block',
  'Academic Block',
  'Library',
  'Cafeteria',
  'Sports Complex',
];

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const NewComplaint = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category');
  const validCategory = CATEGORY_OPTIONS.some((opt) => opt.value === initialCategory)
    ? initialCategory
    : 'other';

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: validCategory,
    location: '',
    priority: 'low',
  });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [mapPin, setMapPin] = useState(DEFAULT_CAMPUS_PIN);
  const [locationFromMap, setLocationFromMap] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleSelectedFile = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    setError(null);
    setImageFile(file);
  };

  const handleFileChange = (e) => {
    handleSelectedFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleSelectedFile(e.dataTransfer.files?.[0]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'location') {
      setLocationFromMap(false);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMapPinChange = (nextPin) => {
    const resolvedPin = nextPin || DEFAULT_CAMPUS_PIN;
    setMapPin(resolvedPin);

    if (resolvedPin.source === 'default') {
      if (locationFromMap) {
        setFormData((prev) => ({ ...prev, location: '' }));
        setLocationFromMap(false);
      }
      return;
    }

    const canAutoFill =
      !formData.location.trim() ||
      locationFromMap ||
      resolvedPin.source === 'gps';

    if (canAutoFill) {
      const nextText =
        resolvedPin.source === 'gps'
          ? `GPS Location (${resolvedPin.lat}, ${resolvedPin.lng})`
          : `Campus Pin (${resolvedPin.lat}, ${resolvedPin.lng})`;
      setFormData((prev) => ({ ...prev, location: nextText }));
      setLocationFromMap(true);
    }
  };

  const activeZone =
    CAMPUS_ZONES.find((zone) =>
      formData.location.trim().toLowerCase().startsWith(zone.toLowerCase())
    ) || '';

  const handleZoneClick = (zone) => {
    setLocationFromMap(false);
    setFormData((prev) => {
      if (activeZone === zone) {
        return { ...prev, location: '' };
      }
      const trimmed = prev.location.trim();
      if (activeZone && trimmed.toLowerCase().startsWith(activeZone.toLowerCase())) {
        const suffix = trimmed.slice(activeZone.length);
        return { ...prev, location: `${zone}${suffix}` };
      }
      return { ...prev, location: zone };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let uploadedImageUrl = '';
      if (imageFile) {
        const uploadRes = await uploadApi.uploadImage(imageFile);
        uploadedImageUrl = uploadRes.image_url;
      }

      const payload = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        image_url: uploadedImageUrl || undefined,
      };

      const response = await complaintApi.createComplaint(payload);
      navigate(`/student/complaints/${response.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create complaint');
      setIsSubmitting(false);
    }
  };

  const selectedPriority =
    PRIORITY_OPTIONS.find((opt) => opt.value === formData.priority) || PRIORITY_OPTIONS[0];
  const SelectedCategoryIcon = CATEGORY_ICONS[formData.category] || Wrench;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Report an Issue</h1>
          <p className="mt-1 text-sm text-gray-600">
            Submit a campus maintenance or facility ticket for quick resolution.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            to="/student/complaints"
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to My Complaints
          </Link>
          <Link
            to="/student/dashboard"
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* 12-Column Form + Live Ticket Summary Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Main Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs lg:col-span-8"
        >
          {error && <Alert type="error" message={error} />}

          {/* Category Selector */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-600">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {CATEGORY_OPTIONS.map((option) => {
                const Icon = CATEGORY_ICONS[option.value] || Wrench;
                const isSelected = formData.category === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, category: option.value }))
                    }
                    className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-left text-xs font-medium transition-colors ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/20'
                        : 'border-slate-200 bg-white text-gray-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isSelected ? 'text-emerald-600' : 'text-gray-400'
                      }`}
                    />
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="title" className="text-sm font-medium text-gray-700">
                Title
              </label>
              <span className="text-[11px] text-gray-400">{formData.title.length}/100</span>
            </div>
            <Input
              id="title"
              name="title"
              required
              maxLength={100}
              placeholder="E.g., Ceiling fan sparking or water leak in Room 302"
              value={formData.title}
              onChange={handleChange}
            />
          </div>

          {/* Description */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="description" className="text-sm font-medium text-gray-700">
                Description
              </label>
              <span className="text-[11px] text-gray-400">
                {formData.description.length}/500
              </span>
            </div>
            <textarea
              id="description"
              name="description"
              required
              maxLength={500}
              rows={4}
              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
              placeholder="Describe what happened, when it started, and any safety concerns..."
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          {/* Location & Quick Campus Zones */}
          <div className="space-y-2.5">
            <Input
              label="Location"
              id="location"
              name="location"
              required
              maxLength={100}
              placeholder="E.g., Hostel Block B, 3rd Floor, Room 302"
              value={formData.location}
              onChange={handleChange}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-1">
                <span className="shrink-0 text-[11px] font-medium text-gray-400">Quick zones:</span>
                {CAMPUS_ZONES.map((zone) => {
                  const isZoneActive = activeZone === zone;
                  return (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => handleZoneClick(zone)}
                      aria-pressed={isZoneActive}
                      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        isZoneActive
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20'
                          : 'border-slate-200 bg-slate-50 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800'
                      }`}
                    >
                      <MapPin
                        className={`h-3 w-3 ${isZoneActive ? 'text-emerald-600' : 'text-gray-400'}`}
                      />
                      {zone}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowMap((prev) => !prev)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                <MapIcon className="h-3.5 w-3.5" />
                {showMap ? 'Hide Map' : 'Campus Map'}
              </button>
            </div>

            {showMap && (
              <CampusMapPicker
                pin={mapPin}
                onPinChange={handleMapPinChange}
              />
            )}
          </div>

          {/* Priority & Impact */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-600">
              Priority &amp; Impact
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = formData.priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, priority: opt.value }))
                    }
                    className={`flex h-full flex-col justify-between rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? opt.activeClass
                        : 'border-slate-200 bg-white text-gray-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className={`h-2 w-2 rounded-full ${opt.dotClass}`} />
                        {opt.label}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${opt.badgeClass}`}
                      >
                        {opt.sla}
                      </span>
                    </div>
                    <span className="mt-1.5 text-[11px] opacity-80">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Attachment */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Photo Attachment{' '}
              <span className="text-xs font-normal text-gray-400">(Optional)</span>
            </label>

            {!imageFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-5 text-center transition-colors ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/70'
                    : 'border-slate-200 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30'
                }`}
              >
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-600 shadow-2xs ring-1 ring-slate-200">
                  <Upload className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold text-gray-800">
                  Click to upload or drag &amp; drop an image
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500">JPG, PNG, or WebP</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Selected attachment preview"
                      className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-gray-400">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-gray-900">
                      {imageFile.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {formatFileSize(imageFile.size)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      setImageFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              id="image"
              name="image"
              accept="image/jpeg, image/png, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Link to="/student/dashboard">
              <Button
                variant="secondary"
                type="button"
                className="h-10 w-full px-5 text-xs sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 w-full px-5 text-xs font-semibold sm:w-auto"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
            </Button>
          </div>
        </form>

        {/* Right Companion Column */}
        <div className="space-y-4 lg:col-span-4">
          {/* Live Ticket Preview */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Tag className="h-4 w-4 text-emerald-600" />
                Live Ticket Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 pt-4 text-xs">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Title
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {formData.title.trim() || (
                    <span className="font-normal text-gray-400">Enter a complaint title...</span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-gray-700">
                  <SelectedCategoryIcon className="h-3.5 w-3.5 text-emerald-600" />
                  {getCategoryLabel(formData.category)}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${selectedPriority.badgeClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${selectedPriority.dotClass}`} />
                  {selectedPriority.label} · {selectedPriority.sla}
                </span>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Location
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-gray-700">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">
                    {formData.location.trim() || (
                      <span className="text-gray-400">Not specified yet</span>
                    )}
                  </span>
                </p>
                {mapPin && (
                  <p className="mt-0.5 pl-5 font-mono text-[10px] text-emerald-700">
                    Pin: {mapPin.lat}, {mapPin.lng}
                  </p>
                )}
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Attachment
                </p>
                <p className="mt-1 text-gray-600">
                  {imageFile ? `${imageFile.name} (${formatFileSize(imageFile.size)})` : 'No photo attached'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3-Bullet Quick Reporting Checklist */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Quick Reporting Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs text-gray-600">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p>Specify exact building, floor, and room number for faster dispatch.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p>Attach a clear photo showing the damage or equipment label when possible.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p>Check My Complaints first to avoid duplicate reports for the same area.</p>
              </div>
              <div className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-[11px] leading-4 text-amber-900">
                <span className="font-semibold">Accountability Notice:</span> Every ticket is
                logged against your Student ID. False or prank complaints are flagged for
                administrative review.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
