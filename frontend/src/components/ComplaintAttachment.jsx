import React, { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const resolveProtectedEndpoint = (imageUrl) => {
  if (!imageUrl) return null;

  const protectedMatch = imageUrl.match(/\/api\/v1\/upload\/files\/([^/?#]+)$/);
  if (protectedMatch) {
    return `${API_BASE_URL}/upload/files/${protectedMatch[1]}`;
  }

  // Backward compatibility for legacy /uploads/<filename> records
  const legacyMatch = imageUrl.match(/\/uploads\/([^/?#]+)$/);
  if (legacyMatch) {
    return `${API_BASE_URL}/upload/files/${legacyMatch[1]}`;
  }

  return null;
};

export const ComplaintAttachment = ({ imageUrl }) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const protectedUrl = resolveProtectedEndpoint(imageUrl);

  useEffect(() => {
    if (!imageUrl || !protectedUrl) {
      setObjectUrl(null);
      setError(null);
      return;
    }

    let revoked = false;
    let createdUrl = null;
    const controller = new AbortController();

    const loadAttachment = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(protectedUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Unable to load attachment');
        }
        const blob = await response.blob();
        createdUrl = URL.createObjectURL(blob);
        if (!revoked) {
          setObjectUrl(createdUrl);
        } else {
          URL.revokeObjectURL(createdUrl);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && !revoked) {
          setError('Attachment unavailable');
        }
      } finally {
        if (!revoked) {
          setLoading(false);
        }
      }
    };

    loadAttachment();

    return () => {
      revoked = true;
      controller.abort();
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [imageUrl, protectedUrl]);

  if (!imageUrl) return null;

  const displayUrl = protectedUrl ? objectUrl : imageUrl;

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-medium text-gray-900 mb-2">Attached Image</h3>
      {loading && <p className="text-sm text-gray-500">Loading attachment...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {displayUrl && (
        <>
          <div className="mb-2">
            <img
              src={displayUrl}
              alt="Complaint Attachment"
              className="max-w-full h-auto max-h-96 rounded-md shadow-sm border border-gray-200"
            />
          </div>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline text-sm break-all"
          >
            Open Attached Image
          </a>
        </>
      )}
    </div>
  );
};
