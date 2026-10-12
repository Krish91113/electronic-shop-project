import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  ScanLine,
  X,
  AlertTriangle,
  CheckCircle2,
  Keyboard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────

export interface BarcodeScanResult {
  barcode: string;
  format: string;
}

export interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: BarcodeScanResult) => void;
  title?: string;
  description?: string;
}

type ScannerStatus =
  "idle" | "requesting" | "scanning" | "success" | "error" | "denied" | "unsupported";

// ─── Barcode validation ──────────────────────────────────────────

/** Supported barcode formats */
const SUPPORTED_FORMATS = [
  "EAN_13",
  "EAN_8",
  "UPC_A",
  "UPC_E",
  "CODE_128",
  "CODE_39",
  "QR_CODE",
] as const;

function isValidBarcode(code: string): boolean {
  // Allow digits, dashes, and alphanumeric for Code 128
  if (!code || code.trim().length === 0) return false;
  if (code.length < 4 || code.length > 128) return false;
  // Must contain at least some alphanumeric characters
  return /^[\w\-./]+$/.test(code);
}

function normalizeBarcode(code: string): string {
  // Trim whitespace but preserve leading zeros (important for EAN/UPC)
  return code.trim();
}

// ─── BarcodeScanner Component ────────────────────────────────────

export function BarcodeScanner({
  open,
  onOpenChange,
  onScan,
  title = "Scan Barcode",
  description = "Point your camera at a barcode or enter it manually.",
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<unknown>(null);
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState("");

  // ─── Stop camera ─────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Stop ZXing reader
    if (scannerRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (scannerRef.current as any).reset?.();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
  }, []);

  // ─── Start camera and scanning ─────────────────────────────────

  const startScanning = useCallback(async () => {
    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setErrorMessage("Camera access is not supported in this browser. Use manual entry instead.");
      return;
    }

    setStatus("requesting");
    setErrorMessage("");

    try {
      // Request camera with rear preference
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus("scanning");

      // Dynamically import @zxing/browser to avoid SSR issues
      const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } =
        await import("@zxing/library");

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.QR_CODE,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      scannerRef.current = reader;

      // Start continuous decode from video element
      reader.decodeFromStream(stream, videoRef.current!, (result, error) => {
        if (result) {
          const rawCode = result.getText();
          const normalized = normalizeBarcode(rawCode);
          const now = Date.now();

          // Prevent duplicate scans within 3 seconds of the same barcode
          if (normalized === lastScannedRef.current && now - lastScanTimeRef.current < 3000) {
            return;
          }

          if (!isValidBarcode(normalized)) {
            return;
          }

          lastScannedRef.current = normalized;
          lastScanTimeRef.current = now;
          setScannedCode(normalized);
          setStatus("success");

          // Stop scanning after successful scan
          stopCamera();

          // Notify parent after a brief visual feedback delay
          setTimeout(() => {
            const formatName = result.getBarcodeFormat()?.toString() ?? "UNKNOWN";
            onScan({ barcode: normalized, format: formatName });
          }, 600);
        }
        // Silently ignore decode errors (no barcode in view)
      });
    } catch (err) {
      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setStatus("denied");
        setErrorMessage(
          "Camera permission was denied. Please allow camera access in your browser settings, or use manual entry.",
        );
      } else if (error.name === "NotFoundError") {
        setStatus("error");
        setErrorMessage("No camera found on this device. Use manual entry instead.");
      } else if (error.name === "NotReadableError") {
        setStatus("error");
        setErrorMessage(
          "Camera is in use by another application. Close other camera apps and try again.",
        );
      } else {
        setStatus("error");
        setErrorMessage(`Camera error: ${error.message || "Unknown error"}`);
      }
    }
  }, [onScan, stopCamera]);

  // ─── Handle dialog open/close ──────────────────────────────────

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setStatus("idle");
      setErrorMessage("");
      setScannedCode("");
      setShowManual(false);
      setManualInput("");
      lastScannedRef.current = "";
      lastScanTimeRef.current = 0;

      // Small delay to let dialog mount before starting camera
      const timer = setTimeout(() => {
        void startScanning();
      }, 300);

      return () => clearTimeout(timer);
    } else {
      // Stop camera when dialog closes
      stopCamera();
      return undefined;
    }
  }, [open, startScanning, stopCamera]);

  // ─── Cleanup on unmount ────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ─── Manual entry handler ──────────────────────────────────────

  const handleManualSubmit = () => {
    const code = normalizeBarcode(manualInput);
    if (!isValidBarcode(code)) {
      setErrorMessage("Please enter a valid barcode (at least 4 characters).");
      return;
    }
    setScannedCode(code);
    setStatus("success");
    stopCamera();
    setTimeout(() => {
      onScan({ barcode: code, format: "MANUAL" });
    }, 400);
  };

  const handleManualKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleManualSubmit();
    }
  };

  // ─── USB/Bluetooth barcode scanner detection ───────────────────
  // These scanners typically type characters rapidly then press Enter

  useEffect(() => {
    if (!open || showManual) return;

    let buffer = "";
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is focused on an input already
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const now = Date.now();

      if (e.key === "Enter" && buffer.length >= 4) {
        e.preventDefault();
        const code = normalizeBarcode(buffer);
        if (isValidBarcode(code)) {
          setScannedCode(code);
          setStatus("success");
          stopCamera();
          setTimeout(() => {
            onScan({ barcode: code, format: "USB_SCANNER" });
          }, 400);
        }
        buffer = "";
        return;
      }

      // USB scanners type very fast (< 50ms between keys)
      if (now - lastKeyTime > 100) {
        buffer = "";
      }

      if (e.key.length === 1) {
        buffer += e.key;
        lastKeyTime = now;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, showManual, onScan, stopCamera]);

  // ─── Render ────────────────────────────────────────────────────

  const statusIcon = () => {
    switch (status) {
      case "requesting":
        return <Loader2 className="animate-spin" size={24} />;
      case "success":
        return <CheckCircle2 size={24} className="text-emerald-500" />;
      case "denied":
      case "error":
      case "unsupported":
        return <AlertTriangle size={24} className="text-amber-500" />;
      default:
        return <Camera size={24} />;
    }
  };

  const statusText = () => {
    switch (status) {
      case "requesting":
        return "Requesting camera access…";
      case "scanning":
        return "Point camera at barcode";
      case "success":
        return `Scanned: ${scannedCode}`;
      case "denied":
        return "Camera access denied";
      case "unsupported":
        return "Camera not supported";
      case "error":
        return "Camera error";
      default:
        return "Initializing…";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="barcode-scanner-dialog">
        <DialogTitle className="flex items-center gap-2">
          <ScanLine size={20} />
          {title}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>

        <div className="barcode-scanner-content">
          {/* Camera preview area */}
          {!showManual && (
            <div className="scanner-viewport">
              <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />

              {/* Scan frame overlay */}
              {status === "scanning" && (
                <div className="scanner-overlay">
                  <div className="scanner-frame">
                    <div className="scanner-corner scanner-corner-tl" />
                    <div className="scanner-corner scanner-corner-tr" />
                    <div className="scanner-corner scanner-corner-bl" />
                    <div className="scanner-corner scanner-corner-br" />
                    <div className="scanner-line" />
                  </div>
                </div>
              )}

              {/* Status indicator */}
              <div className={`scanner-status scanner-status-${status}`}>
                {statusIcon()}
                <span>{statusText()}</span>
              </div>

              {/* Error message */}
              {errorMessage &&
                (status === "denied" || status === "error" || status === "unsupported") && (
                  <div className="scanner-error">
                    <AlertTriangle size={16} />
                    <p>{errorMessage}</p>
                  </div>
                )}

              {/* Success indicator */}
              {status === "success" && (
                <div className="scanner-success">
                  <CheckCircle2 size={28} />
                  <p className="font-mono text-lg">{scannedCode}</p>
                </div>
              )}
            </div>
          )}

          {/* Manual entry */}
          {showManual && (
            <div className="scanner-manual">
              <div className="scanner-manual-icon">
                <Keyboard size={32} />
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Type or paste the barcode number below.
              </p>
              <div className="flex gap-2">
                <Input
                  ref={manualInputRef}
                  placeholder="Enter barcode number…"
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value);
                    setErrorMessage("");
                  }}
                  onKeyDown={handleManualKeyDown}
                  autoFocus
                  className="font-mono"
                />
                <Button onClick={handleManualSubmit} disabled={!manualInput.trim()}>
                  Submit
                </Button>
              </div>
              {errorMessage && <p className="text-sm text-destructive mt-2">{errorMessage}</p>}
            </div>
          )}

          {/* Action buttons */}
          <div className="scanner-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (showManual) {
                  setShowManual(false);
                  setErrorMessage("");
                  startScanning();
                } else {
                  stopCamera();
                  setShowManual(true);
                  setErrorMessage("");
                }
              }}
            >
              {showManual ? (
                <>
                  <Camera size={16} /> Use Camera
                </>
              ) : (
                <>
                  <Keyboard size={16} /> Manual Entry
                </>
              )}
            </Button>

            {(status === "error" || status === "denied") && !showManual && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  stopCamera();
                  setTimeout(() => startScanning(), 200);
                }}
              >
                Retry Camera
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X size={16} /> Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline barcode input (for USB/Bluetooth scanners + manual) ───

export interface BarcodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (barcode: string) => void;
  onScanClick: () => void;
  placeholder?: string;
  disabled?: boolean;
  scanning?: boolean;
}

export function BarcodeInput({
  value,
  onChange,
  onSubmit,
  onScanClick,
  placeholder = "Scan barcode or type and press Enter…",
  disabled = false,
  scanning = false,
}: BarcodeInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = normalizeBarcode(value);
      if (isValidBarcode(code)) {
        onSubmit(code);
      }
    }
  };

  return (
    <div className="barcode-input-row">
      <div className="search-input" style={{ flex: 1 }}>
        <ScanLine size={18} />
        <Input
          aria-label={placeholder}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || scanning}
          className="font-mono"
        />
      </div>
      <Button
        variant="outline"
        onClick={() => {
          const code = normalizeBarcode(value);
          if (isValidBarcode(code)) {
            onSubmit(code);
          }
        }}
        disabled={!value.trim() || disabled || scanning}
        aria-label="Lookup barcode"
      >
        {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
        {scanning ? "Looking up…" : "Lookup"}
      </Button>
      <Button
        onClick={onScanClick}
        disabled={disabled}
        aria-label="Open barcode scanner camera"
        className="barcode-camera-btn"
      >
        <Camera size={16} />
        <span className="hidden sm:inline">Scan</span>
      </Button>
    </div>
  );
}
