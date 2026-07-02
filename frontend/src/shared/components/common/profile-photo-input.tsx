import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";

interface ProfilePhotoInputProps {
  value: File | null;
  onChange: (file: File | null) => void;
  previewUrl?: string | null;
  disabled?: boolean;
}

export function ProfilePhotoInput({
  value,
  onChange,
  previewUrl,
  disabled = false,
}: ProfilePhotoInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const displayPreview = localPreview ?? previewUrl ?? null;

  useEffect(() => {
    if (!value) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const openCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError("Could not access the camera. Check permissions or upload a photo instead.");
    }
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setCameraError(null);
  };

  useEffect(() => () => stopCamera(), []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "profile-photo.jpg", { type: "image/jpeg" });
        onChange(file);
        closeCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const clearPhoto = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        Profile photo <span className="text-red-500">*</span>
      </label>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-28 h-28 rounded-full overflow-hidden bg-muted ring-2 ring-border flex items-center justify-center shrink-0">
          {displayPreview ? (
            <img src={displayPreview} alt="Profile preview" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8 text-muted-foreground" />
          )}
          {displayPreview && !disabled && (
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute top-1 right-1 p-1 rounded-full bg-background/90 border border-border text-muted-foreground hover:text-foreground"
              aria-label="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-md border border-border hover:bg-accent disabled:opacity-50"
          >
            <ImagePlus className="w-4 h-4" />
            Upload photo
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void openCamera()}
            className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-md border border-border hover:bg-accent disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            Take picture
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        hidden
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onChange(file);
        }}
      />

      <p className="text-xs text-muted-foreground">
        A clear photo of your face is required for identity verification during exams.
      </p>

      {cameraError && (
        <p className="text-xs text-red-600 dark:text-red-400">{cameraError}</p>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Take your profile photo</h3>
              <button
                type="button"
                onClick={closeCamera}
                className="p-1 rounded-md hover:bg-accent"
                aria-label="Close camera"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-[4/3] rounded-lg overflow-hidden bg-black">
              <video ref={videoRef} className="w-full h-full object-cover -scale-x-100" playsInline muted />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCamera}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
