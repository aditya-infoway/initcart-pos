import { Capacitor } from "@capacitor/core";
import {
  BarcodeScanner,
  BarcodeFormat,
} from "@capacitor-mlkit/barcode-scanning";

/** Sirf native app (APK) me true; browser me false */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/**
 * Camera khol kar barcode scan karta hai.
 * Return: scanned value (string) ya null (cancel / error)
 */
export const scanBarcodeWithCamera = async (): Promise<string | null> => {
  // 1. Scanner supported hai ya nahi
  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) {
    throw new Error("Barcode scanning is not supported on this device");
  }

  // 2. Camera permission
  const perm = await BarcodeScanner.checkPermissions();
  if (perm.camera !== "granted") {
    const req = await BarcodeScanner.requestPermissions();
    if (req.camera !== "granted") {
      throw new Error("Camera permission denied");
    }
  }

  // 3. Google Barcode Scanner module (Play Services) available hai ya nahi
  //    Pehli baar ye module download hota hai
  try {
    const { available } =
      await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }
  } catch {
    // Kuch devices par ye method fail ho sakta hai; scan() try karne do
  }

  // 4. Scan
  const { barcodes } = await BarcodeScanner.scan({
    formats: [
      BarcodeFormat.Code128,
      BarcodeFormat.Code39,
      BarcodeFormat.Ean13,
      BarcodeFormat.Ean8,
      BarcodeFormat.UpcA,
      BarcodeFormat.UpcE,
      BarcodeFormat.QrCode,
    ],
  });

  const raw = barcodes?.[0]?.rawValue;
  if (!raw) return null;

  // Aapke DB me barcode sirf alphanumeric hota hai, isliye same cleaning
  return raw.replace(/[^a-zA-Z0-9]/g, "");
};