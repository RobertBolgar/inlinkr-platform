import { useState } from 'react';
import { X, Link as LinkIcon } from 'lucide-react';
import { db } from '../lib/cloudflare';

interface ReuseDestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkId: number;
  linkTitle: string;
  onSuccess: () => void;
}

export function ReuseDestinationModal({ isOpen, onClose, linkId, linkTitle, onSuccess }: ReuseDestinationModalProps) {
  const [youtubeVideoId, setYoutubeVideoId] = useState('');
  const [placementType, setPlacementType] = useState('');
  const [placementName, setPlacementName] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [publicCode, setPublicCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await db.createLinkUsage({
        link_id: linkId,
        youtube_video_id: youtubeVideoId || undefined,
        placement_type: placementType || undefined,
        placement_name: placementName || undefined,
        source_code: sourceCode || undefined,
        public_code: publicCode || undefined,
      });

      onSuccess();
      onClose();
      // Reset form
      setYoutubeVideoId('');
      setPlacementType('');
      setPlacementName('');
      setSourceCode('');
      setPublicCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach destination to video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-blue-400" />
            Reuse Destination Link
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Attach this destination link to another YouTube video or context. This creates a new usage record without duplicating the link.
        </p>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
          <div className="text-xs text-gray-500 mb-1">Destination Link</div>
          <div className="text-sm font-medium text-white">{linkTitle}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              YouTube Video ID (Optional)
            </label>
            <input
              type="text"
              value={youtubeVideoId}
              onChange={(e) => setYoutubeVideoId(e.target.value)}
              placeholder="e.g., abc123xyz"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Placement Type (Optional)
            </label>
            <input
              type="text"
              value={placementType}
              onChange={(e) => setPlacementType(e.target.value)}
              placeholder="e.g., description, pinned, bio"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Placement Name (Optional)
            </label>
            <input
              type="text"
              value={placementName}
              onChange={(e) => setPlacementName(e.target.value)}
              placeholder="e.g., My placement"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Source Code (Optional)
            </label>
            <input
              type="text"
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="e.g., d, p, b, s, v"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Public Code (Optional)
            </label>
            <input
              type="text"
              value={publicCode}
              onChange={(e) => setPublicCode(e.target.value)}
              placeholder="e.g., desc1"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Attaching...' : 'Attach'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
