import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  ExternalLink,
  MapPin,
  Compass,
  Hash,
  Map as MapIcon,
} from 'lucide-react';
import { CloseButton, Skeleton, useGlass } from '@aireon/shared';
import {
  listImages,
  deleteImage,
  APP_LABELS,
  type SavedImage,
  type ScreenshotMetadata,
} from '../lib/imageService';
import { t } from '../js/i18n.js';

const SHOWROOM_URL = 'https://showroom.aireon.ch/';
// Modal is a quick-glance preview; the full catalog lives in the Showroom
// app, reachable via the "See all publications in Showroom" button.
const MAX_VISIBLE_IMAGES = 3;

// Fields rendered explicitly in the preview metadata block. Anything else in
// custom_metadata is shown in a generic "more" list so flexible fields
// surface without code changes.
const KNOWN_META_KEYS = new Set([
  'url',
  'viewport',
  'captured_at',
  'central_lat',
  'central_lng',
  'central_parcel_id',
  'tilt_degree',
  'bearing_degree',
  'zoom',
  'address',
  'basemap',
  'is_3d_mode',
]);

const formatCoord = (n: unknown) => (typeof n === 'number' ? n.toFixed(5) : null);
const formatDeg = (n: unknown) => (typeof n === 'number' ? `${Math.round(n)}°` : null);

interface SavedImagesPanelProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function SavedImagesPanel({ darkMode, isOpen, onClose }: SavedImagesPanelProps) {
  const { level: glassLevel } = useGlass();
  const glassOn = glassLevel > 0;
  // Glass owns the surface fill / border / shadow when on; otherwise keep the
  // original solid panel. The portal-wrapper (below) carries `.dark` +
  // `data-glass` so the glass tokens (incl. the dark variants) resolve here,
  // out of the app-root tree this modal portals away from. `shadow` lets a
  // surface keep its own elevation utility (shadow-2xl / shadow-xl) when solid.
  const surfaceFill = (shadow = 'shadow-2xl') =>
    glassOn ? 'glass-surface' : `${shadow} ${darkMode ? 'bg-gray-800' : 'bg-white'}`;
  const [images, setImages] = useState<SavedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // similoo has no toast context — a failed delete surfaces as a dismissable
  // inline banner at the top of the grid (using the shared `gallery.dismiss`
  // string) instead of a global toast.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<SavedImage | null>(null);
  // Inline confirm modal state — replaces the blocking `window.confirm` call.
  // We stash the id pending deletion so the user can cancel before any
  // network call goes out.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Focus management: focus the panel close button on open, restore focus to
  // the opener on close. Gated on isOpen because the component stays mounted
  // and renders null when closed.
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement;
    const id = requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      const prev = previousFocusRef.current as HTMLElement | null;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [isOpen]);

  const load = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      // No app_source filter — list across every app the user has used so
      // images saved in valoo (or any other app) appear here too. The APP
      // badge on each card identifies the source app.
      const data = await listImages();
      setImages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('gallery.load_failed'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Layered escape: confirm modal first, then preview, then panel itself.
      if (pendingDeleteId) setPendingDeleteId(null);
      else if (previewImage) setPreviewImage(null);
      else if (isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, previewImage, pendingDeleteId]);

  const requestDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      if (previewImage?.id === id) setPreviewImage(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('gallery.delete_failed');
      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const visibleImages = useMemo(() => images.slice(0, MAX_VISIBLE_IMAGES), [images]);
  const hiddenCount = Math.max(0, images.length - visibleImages.length);

  if (!isOpen) return null;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderCardMeta = (meta: ScreenshotMetadata | null) => {
    if (!meta) return null;
    const lat = formatCoord(meta.central_lat);
    const lng = formatCoord(meta.central_lng);
    const tilt = formatDeg(meta.tilt_degree);
    const lines: { icon: JSX.Element; text: string; key: string }[] = [];
    if (meta.address) {
      lines.push({ key: 'addr', icon: <MapPin size={11} />, text: meta.address });
    }
    if (lat && lng) {
      lines.push({ key: 'coord', icon: <MapIcon size={11} />, text: `${lat}, ${lng}` });
    }
    if (meta.central_parcel_id) {
      lines.push({ key: 'parcel', icon: <Hash size={11} />, text: String(meta.central_parcel_id) });
    }
    if (tilt) {
      lines.push({ key: 'tilt', icon: <Compass size={11} />, text: t('gallery.tilt_value', { value: tilt }) });
    }
    if (lines.length === 0) return null;
    return (
      <div className="mt-1 space-y-1">
        {lines.map((l) => (
          <div
            key={l.key}
            className={`flex items-center gap-1.5 text-[11px] ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            <span className={`flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {l.icon}
            </span>
            <span className="truncate" title={l.text}>{l.text}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderPreviewMeta = (img: SavedImage) => {
    const meta = img.custom_metadata || {};
    const lat = formatCoord(meta.central_lat);
    const lng = formatCoord(meta.central_lng);
    const tilt = formatDeg(meta.tilt_degree);
    const bearing = formatDeg(meta.bearing_degree);
    const zoom = typeof meta.zoom === 'number' ? meta.zoom.toFixed(1) : null;

    const rows: { label: string; value: string }[] = [
      { label: t('gallery.col_app'), value: APP_LABELS[img.app_source] || img.app_source },
      { label: t('gallery.col_saved'), value: formatDate(img.created_at) },
      { label: t('gallery.col_dimensions'), value: `${img.width}×${img.height}` },
      { label: t('gallery.col_size'), value: formatSize(img.file_size) },
    ];
    if (meta.address) rows.push({ label: t('gallery.col_address'), value: meta.address });
    if (lat && lng) rows.push({ label: t('gallery.col_center'), value: `${lat}, ${lng}` });
    if (meta.central_parcel_id) {
      rows.push({ label: t('gallery.col_parcel_id'), value: String(meta.central_parcel_id) });
    }
    if (tilt) rows.push({ label: t('gallery.col_tilt'), value: tilt });
    if (bearing) rows.push({ label: t('gallery.col_bearing'), value: bearing });
    if (zoom) rows.push({ label: t('gallery.col_zoom'), value: zoom });
    if (meta.basemap) rows.push({ label: t('gallery.col_basemap'), value: String(meta.basemap) });
    if (typeof meta.is_3d_mode === 'boolean') {
      rows.push({ label: t('gallery.col_3d_mode'), value: meta.is_3d_mode ? t('gallery.mode_on') : t('gallery.mode_off') });
    }

    const extras = Object.entries(meta).filter(
      ([k, v]) => !KNOWN_META_KEYS.has(k) && v !== null && v !== undefined && v !== ''
    );

    return (
      <div className={`text-xs space-y-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-3">
              <span className={`w-24 flex-shrink-0 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {r.label}
              </span>
              <span className="flex-1 break-words font-medium">{r.value}</span>
            </div>
          ))}
        </div>
        {extras.length > 0 && (
          <div className={`pt-2 border-t space-y-1 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <p
              className={`text-[10px] uppercase tracking-wide ${
                darkMode ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              {t('gallery.additional_metadata')}
            </p>
            {extras.map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span
                  className={`w-24 flex-shrink-0 break-all ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {k}
                </span>
                <span className="flex-1 break-words font-medium">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Portal to document.body so the modal escapes ancestor containing blocks
  // (the Header uses `backdrop-blur-md`, which makes any descendant
  // `position: fixed` scope to the header's bounds instead of the viewport).
  return createPortal(
    // Carrier for the body-portal subtree: `.dark` + `data-glass` so the glass
    // tokens (incl. the `.dark[data-glass]` dark variants) resolve here, since
    // this modal renders outside similoo's themed app root. Zero-box wrapper —
    // its children are all `position: fixed`, so it never affects layout.
    <div className={darkMode ? 'dark' : undefined} data-glass={glassLevel} data-screenshot-ignore="true">
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div role="presentation" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="saved-images-title"
          className={`relative rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden ${surfaceFill()}`}
        >
          <div
            className={`flex items-center justify-between gap-3 px-5 py-4 border-b ${
              darkMode ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ImageIcon size={18} className="text-cyan-500 flex-shrink-0" />
              <h2
                id="saved-images-title"
                className={`text-base font-semibold truncate ${
                  darkMode ? 'text-gray-100' : 'text-gray-900'
                }`}
              >
                {t('gallery.title')}
              </h2>
              {!isLoading && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {images.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <a
                href={SHOWROOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors ${
                  darkMode ? 'text-cyan-300' : 'text-cyan-700'
                }`}
              >
                {t('gallery.see_in_showroom')}
                <ExternalLink size={13} />
              </a>
              <a
                href={SHOWROOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('gallery.see_in_showroom')}
                title={t('gallery.see_in_showroom')}
                className={`sm:hidden p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors ${
                  darkMode ? 'text-cyan-300' : 'text-cyan-600'
                }`}
              >
                <ExternalLink size={16} />
              </a>
              <button
                onClick={() => load(true)}
                disabled={isRefreshing}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 ${
                  darkMode
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-500'
                }`}
                aria-label={t('gallery.refresh')}
                title={t('gallery.refresh')}
              >
                {isRefreshing ? (
                  <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
                  </span>
                ) : (
                  <RefreshCw size={16} />
                )}
              </button>
              <CloseButton
                ref={closeBtnRef}
                onClick={onClose}
                label={t('gallery.close')}
                dark={darkMode}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {deleteError && (
              <div className="mb-4 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-500 flex-1 break-words">{deleteError}</p>
                <button
                  onClick={() => setDeleteError(null)}
                  className="text-xs font-medium text-red-500 hover:text-red-400 flex-shrink-0"
                >
                  {t('gallery.dismiss')}
                </button>
              </div>
            )}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border overflow-hidden flex flex-col ${
                      darkMode
                        ? 'border-gray-700 bg-gray-900/40'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <Skeleton dark={darkMode} radius={0} className="w-full aspect-video" />
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5">
                        <Skeleton dark={darkMode} width={42} height={14} radius={4} />
                        <Skeleton dark={darkMode} height={12} radius={4} className="flex-1" delay="60ms" />
                      </div>
                      <Skeleton dark={darkMode} width={88} height={10} radius={4} delay="120ms" />
                      <Skeleton dark={darkMode} width={128} height={10} radius={4} delay="160ms" />
                      <div className="mt-2 flex items-center gap-2">
                        <Skeleton dark={darkMode} height={28} radius={6} className="flex-1" delay="200ms" />
                        <Skeleton dark={darkMode} width={32} height={28} radius={6} delay="200ms" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-sm text-red-500 mb-3">{error}</p>
                <button
                  onClick={() => load()}
                  className="text-xs text-cyan-600 hover:text-cyan-500 font-medium"
                >
                  {t('gallery.try_again')}
                </button>
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-16">
                <ImageIcon
                  size={40}
                  className={`mx-auto mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}
                />
                <p className={`text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('gallery.empty_title')}
                </p>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('gallery.empty_hint')}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleImages.map((img) => (
                    <div
                      key={img.id}
                      className={`group rounded-xl border overflow-hidden flex flex-col ${
                        darkMode
                          ? 'border-gray-700 bg-gray-900/40'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <button
                        onClick={() => setPreviewImage(img)}
                        aria-label={t('gallery.open_preview', { name: img.original_filename })}
                        className={`relative aspect-video overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50 ${
                          darkMode ? 'bg-gray-900' : 'bg-gray-100'
                        }`}
                      >
                        <img
                          src={img.public_url}
                          alt={img.original_filename}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      </button>
                      <div className="p-3 flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-500/15 ${
                              darkMode ? 'text-blue-300' : 'text-blue-700'
                            }`}
                          >
                            {APP_LABELS[img.app_source] || img.app_source}
                          </span>
                          <p
                            className={`text-xs font-medium truncate flex-1 min-w-0 ${
                              darkMode ? 'text-gray-100' : 'text-gray-900'
                            }`}
                          >
                            {img.original_filename}
                          </p>
                        </div>
                        <p
                          className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                        >
                          {formatDate(img.created_at)}
                        </p>
                        <p
                          className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}
                        >
                          {img.width}×{img.height} · {formatSize(img.file_size)}
                        </p>
                        {renderCardMeta(img.custom_metadata)}
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={img.public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-white transition-colors ${
                              darkMode
                                ? 'bg-red-600 hover:bg-red-500'
                                : 'bg-red-500 hover:bg-red-600'
                            }`}
                          >
                            <ExternalLink size={12} />
                            {t('gallery.open')}
                          </a>
                          <button
                            onClick={() => requestDelete(img.id)}
                            disabled={deletingId === img.id}
                            className={`inline-flex items-center justify-center px-2 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50 ${
                              darkMode ? 'text-red-400' : 'text-red-600'
                            }`}
                            aria-label={t('gallery.delete')}
                            title={t('gallery.delete')}
                          >
                            {deletingId === img.id ? (
                              <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
                              </span>
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {hiddenCount > 0 && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                    <p
                      className={`text-xs text-center sm:text-left ${
                        darkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      {t('gallery.footer_cta', {
                        visible: visibleImages.length,
                        total: images.length,
                        hidden: hiddenCount,
                      })}
                    </p>
                    <a
                      href={SHOWROOM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white transition-colors flex-shrink-0"
                    >
                      {t('gallery.see_in_showroom')}
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('gallery.open_preview', { name: previewImage.original_filename })}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="absolute inset-0 bg-black/80" />
          <div
            className="relative w-full max-w-6xl max-h-[95vh] flex flex-col lg:flex-row gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex-1 min-w-0 flex items-center justify-center">
              <img
                src={previewImage.public_url}
                alt={previewImage.original_filename}
                className="max-w-full max-h-[80vh] lg:max-h-[90vh] rounded-lg shadow-2xl object-contain"
              />
              {/* Inside the image container with a backdrop circle so the */}
              {/* tap target stays on-screen on small viewports — the old */}
              {/* `-top-3 -right-3` position clipped below the screen edge */}
              {/* on mobile portrait. */}
              <CloseButton
                variant="surface"
                onClick={() => setPreviewImage(null)}
                label={t('gallery.preview_close')}
                dark={darkMode}
                className="absolute top-3 right-3 z-10"
              />
            </div>
            <div
              className={`w-full lg:w-80 flex-shrink-0 rounded-lg p-4 overflow-y-auto max-h-[40vh] lg:max-h-[90vh] ${surfaceFill('shadow-xl')}`}
            >
              <p
                className={`text-sm font-semibold mb-1 break-all ${
                  darkMode ? 'text-gray-100' : 'text-gray-900'
                }`}
              >
                {previewImage.original_filename}
              </p>
              {renderPreviewMeta(previewImage)}
            </div>
          </div>
        </div>
      )}

      {pendingDeleteId && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="similoo-delete-confirm-title"
        >
          <div
            role="presentation"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPendingDeleteId(null)}
          />
          <div
            className={`relative w-full max-w-sm rounded-xl p-5 ${
              darkMode ? 'text-gray-100' : 'text-gray-900'
            } ${surfaceFill()}`}
          >
            <h3 id="similoo-delete-confirm-title" className="text-base font-semibold mb-2">
              {t('gallery.delete_title')}
            </h3>
            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {t('gallery.delete_confirm')}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDeleteId(null)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('gallery.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold text-white transition-colors ${
                  darkMode ? 'bg-red-600 hover:bg-red-500' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {t('gallery.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
