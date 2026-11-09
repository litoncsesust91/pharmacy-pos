# Phase 13: Responsive UX and Hardware Validation

## Delivered

- Added responsive desktop, tablet, and mobile POS layout behavior.
- Added 44px touch targets and visible keyboard focus states.
- Added keyboard workflows: `F2` completes a sale, `F4` focuses search, and `Escape` clears search.
- Added bounded barcode/scanner input validation with malformed payload rejection.
- Added browser print fallback through a small hardware bridge interface.
- Added receipt print styling and a receipt preview action.
- Added PWA manifest, service worker, install prompt handling, and shell caching.
- Added scanner boundary tests.

## Hardware Boundary

`apps/web/src/hardware.ts` defines the supported bridge surface for receipt printers and cash drawers. The default browser implementation uses `window.print()` and safely refuses cash-drawer commands until an authenticated local bridge is configured. No browser permission is requested by default.

Physical scanner, printer, drawer, and label-printer validation still requires target devices. Scanner payload validation and print fallback are covered in the local test suite.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
