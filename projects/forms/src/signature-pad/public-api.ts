// The @styloviz/forms/signature-pad entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvSignaturePadComponent } from './signature-pad.component';
export type {
  SignaturePadSize,
  SignaturePoint,
  SignatureStroke,
  SignatureValue,
  // What was agreed to, when, and a digest binding the two to the drawing.
  // Read its doc before relying on the hash — it is not tamper-evidence.
  // `FI-21-M1`.
  SignatureAttestation,
} from './signature-pad.types';
export { isSignatureEmpty, pointCount, rescale, toSvg } from './signature-pad.types';
export {
  SV_SIGNATURE_RECORD_FORMAT,
  svSignatureHash,
  svSignatureRecord,
  svVerifySignature,
} from './signature-pad.types';
