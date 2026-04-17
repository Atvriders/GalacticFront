/**
 * Client-side page routing and modal management for GalacticFront.
 */

type PageId = "play" | "store" | "leaderboard" | "settings" | "account";

const VALID_PAGES: ReadonlySet<string> = new Set<PageId>([
  "play",
  "store",
  "leaderboard",
  "settings",
  "account",
]);

let currentPage: PageId = "play";
const openModals: Set<string> = new Set();

/** Navigate to a page by id; hides all pages and shows the target */
export function showPage(pageId: string): void {
  if (!VALID_PAGES.has(pageId)) {
    console.warn(`[Navigation] Unknown page: ${pageId}`);
    return;
  }

  const pages = document.querySelectorAll<HTMLElement>("[data-page]");
  for (const page of pages) {
    page.style.display = page.dataset.page === pageId ? "" : "none";
  }

  currentPage = pageId as PageId;
  window.dispatchEvent(
    new CustomEvent("gf-page-change", { detail: { pageId } }),
  );
}

/** Get currently active page */
export function getCurrentPage(): PageId {
  return currentPage;
}

/** Register a modal as open */
export function openModal(modalId: string): void {
  openModals.add(modalId);
  window.dispatchEvent(
    new CustomEvent("gf-modal-open", { detail: { modalId } }),
  );
}

/** Unregister a modal */
export function closeModal(modalId: string): void {
  openModals.delete(modalId);
  window.dispatchEvent(
    new CustomEvent("gf-modal-close", { detail: { modalId } }),
  );
}

/** Close all open modals */
export function closeAllModals(): void {
  for (const id of openModals) {
    closeModal(id);
  }
}

/** Check if any modal is currently open */
export function hasOpenModal(): boolean {
  return openModals.size > 0;
}

/** Initialize navigation listeners */
export function initNavigation(): void {
  document.addEventListener("nav-change", ((e: CustomEvent) => {
    showPage(e.detail.pageId as string);
  }) as EventListener);
}
