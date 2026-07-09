import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getAllPlacementKinds, getPlacementLabel } from '../lib/placement-intelligence';
import { PlacementBehaviorHint } from './placements/PlacementBehaviorHint';

interface VideoContext {
  video_id: string;
  title?: string | null;
  thumbnail?: string | null;
  url: string;
  placement_name?: string | null;
  is_base: boolean;
  link_usage_id?: number;
}

interface AddPlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (placement: { name: string; type: string; link_usage_id?: number | null; youtube_video_id?: string | null }) => void;
  videoContexts?: VideoContext[];
}

export function AddPlacementModal({ isOpen, onClose, onAdd, videoContexts = [] }: AddPlacementModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('description');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [showVideoSelection, setShowVideoSelection] = useState(false);
  const [attachVideoLater, setAttachVideoLater] = useState(false);

  const placementTypes = getAllPlacementKinds()
    .filter(kind => kind !== 'direct')
    .map(kind => ({
      value: kind,
      label: getPlacementLabel(kind),
    }));

  // Initialize video selection when modal opens
  useEffect(() => {
    if (isOpen && videoContexts.length > 0) {
      // For QR Code placements, always show video selection to allow "Attach video later"
      if (type === 'qr_code') {
        setShowVideoSelection(true);
        setSelectedVideoId(null);
      } else if (videoContexts.length === 1) {
        setSelectedVideoId(videoContexts[0].video_id);
        setShowVideoSelection(false);
      } else {
        setShowVideoSelection(true);
        setSelectedVideoId(null);
      }
    } else if (isOpen && videoContexts.length === 0) {
      setShowVideoSelection(false);
      setSelectedVideoId(null);
    }
    setAttachVideoLater(false);
  }, [isOpen, videoContexts, type]);

  // Handle type changes when modal is open
  useEffect(() => {
    if (isOpen && videoContexts.length > 0) {
      if (type === 'qr_code') {
        // Always show video selection for QR codes to allow "Attach video later"
        setShowVideoSelection(true);
        setSelectedVideoId(null);
        setAttachVideoLater(false);
      } else if (videoContexts.length === 1 && !attachVideoLater) {
        // Auto-select single video for non-QR types
        setSelectedVideoId(videoContexts[0].video_id);
        setShowVideoSelection(false);
      } else if (videoContexts.length > 1) {
        // Show selection for multiple videos
        setShowVideoSelection(true);
        setSelectedVideoId(null);
      }
    }
  }, [type, isOpen, videoContexts]);

  const handleVideoSelect = (videoId: string) => {
    setSelectedVideoId(videoId);
    setShowVideoSelection(false);
  };

  const handleAttachVideoLater = () => {
    setAttachVideoLater(true);
    setSelectedVideoId(null);
    setShowVideoSelection(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalName = name.trim() || getPlacementLabel(type);

    if (finalName.length > 50) {
      setError('Name must be 50 characters or less');
      return;
    }

    setLoading(true);

    try {
      const selectedContext = videoContexts.find(v => v.video_id === selectedVideoId);
      await onAdd({
        name: finalName,
        type,
        link_usage_id: attachVideoLater ? null : (selectedContext?.link_usage_id || null),
        youtube_video_id: attachVideoLater ? null : (selectedContext?.video_id || null)
      });
      setName('');
      setType('description');
      setSelectedVideoId(null);
      setShowVideoSelection(false);
      setAttachVideoLater(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add placement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setType('description');
    setSelectedVideoId(null);
    setShowVideoSelection(false);
    setAttachVideoLater(false);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-md w-full transition-all duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {showVideoSelection ? 'Which video is this placement for?' : 'Track a new placement'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-all duration-200 active:scale-[0.98] p-1 rounded hover:bg-gray-800/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {showVideoSelection ? (
            <>
              {videoContexts.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-3">
                    This helps you keep placements organized across videos.
                  </p>
                  <div className="space-y-2">
                    {videoContexts.map((video) => (
                      <button
                        key={video.video_id}
                        type="button"
                        onClick={() => handleVideoSelect(video.video_id)}
                        className="w-full text-left px-3 py-2.5 bg-gray-950 border border-gray-800 rounded-lg text-gray-300 hover:bg-gray-800 hover:border-gray-700 transition-colors flex items-start gap-3"
                      >
                        {video.thumbnail ? (
                          <img
                            src={video.thumbnail}
                            alt=""
                            className="w-24 h-14 object-cover rounded flex-shrink-0"
                          />
                        ) : (
                          <div className="w-24 h-14 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
                            <span className="text-xs text-gray-600">No thumbnail</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {video.title ? (
                            <div className="text-sm font-medium text-gray-200 truncate mb-0.5">
                              {video.title}
                            </div>
                          ) : (
                            <div className="text-sm font-mono text-gray-300 truncate mb-0.5">
                              {video.url}
                            </div>
                          )}
                          <div className="text-xs font-mono text-gray-500 truncate">
                            {video.url}
                          </div>
                          {video.placement_name && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {video.placement_name}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {type === 'qr_code' && (
                <button
                  type="button"
                  onClick={handleAttachVideoLater}
                  className="w-full text-left px-3 py-2.5 bg-gray-950 border border-gray-800 rounded-lg text-gray-300 hover:bg-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-200">
                    Attach video later
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Create QR code now, attach video after you publish it
                  </div>
                </button>
              )}
            </>
          ) : (
            <>
              {attachVideoLater ? (
                <div className="bg-blue-950/30 border border-blue-800 rounded-lg p-3 mb-4">
                  <div className="text-sm font-medium text-blue-300 mb-1">
                    Video will be attached later
                  </div>
                  <div className="text-xs text-gray-400">
                    You can attach a YouTube video to this QR placement after you publish it.
                  </div>
                </div>
              ) : selectedVideoId && videoContexts.length > 0 && (() => {
                const selectedContext = videoContexts.find(v => v.video_id === selectedVideoId);
                return (
                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 mb-4 flex items-start gap-3">
                    {selectedContext?.thumbnail ? (
                      <img
                        src={selectedContext.thumbnail}
                        alt=""
                        className="w-24 h-14 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-24 h-14 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
                        <span className="text-xs text-gray-600">No thumbnail</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 mb-1">For video:</div>
                      {selectedContext?.title ? (
                        <>
                          <div className="text-sm font-medium text-gray-300 truncate mb-1">
                            {selectedContext.title}
                          </div>
                          <div className="text-xs font-mono text-gray-500 truncate">
                            {selectedContext?.url}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm font-mono text-gray-300 truncate">
                          {selectedContext?.url}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-300 mb-2">
                  Placement type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                >
                  {placementTypes.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
                <PlacementBehaviorHint placementType={type} />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Internal label
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                  placeholder="e.g. Spring sponsor CTA"
                  maxLength={50}
                />
                <p className="mt-1 text-xs text-gray-500">Optional to customize. Helps you tell similar placements apart.</p>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-800 text-red-400 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  {loading ? 'Adding...' : 'Track placement'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
