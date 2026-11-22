/*

Author : Rajveer Sharma
Date : 21 Nov 2026
@ Nxtwave

*/

/**
 * Popups (dropdowns, tooltips) next to their trigger under the interface zoom.
 *
 * On desktop the whole page renders at 90% (`zoom` on <html>, app/globals.css). Base UI measures the
 * trigger in screen pixels and moves the popup by that much, but the zoom shrinks the move too, so
 * popups landed up and to the left of their trigger, more the further right or down it was. These
 * anchors report the trigger's box in the page's own (zoomed) pixels instead; used with
 * `positionMethod="fixed"`, the popup then sits exactly on its trigger. Without zoom they change nothing.
 */

/** The zoom on <html> (1 on phones and tablets). */
export function pageZoom(): number {
  if (typeof document === "undefined") return 1;
  const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom);
  return zoom > 0 ? zoom : 1;
}

/** A positioner `anchor` for the element `target()` returns. */
export function zoomAnchor(target: () => Element | null | undefined) {
  return {
    getBoundingClientRect() {
      const r = target()?.getBoundingClientRect() ?? new DOMRect();
      const z = pageZoom();
      return new DOMRect(r.x / z, r.y / z, r.width / z, r.height / z);
    },
  };
}
