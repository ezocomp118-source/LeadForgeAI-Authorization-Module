export const requireElement = <T extends Element>(
  id: string,
  guard: (element: Element) => element is T,
): T => {
  const element = document.getElementById(id);
  if (element && guard(element)) {
    return element;
  }
  throw new Error(`Missing element #${id}`);
};

export const toggleHidden = (element: HTMLElement, hidden: boolean): void => {
  element.classList.toggle("hidden", hidden);
};

export const setInlineError = (
  element: HTMLElement,
  message: string | null,
): void => {
  if (message === null) {
    toggleHidden(element, true);
    element.textContent = "";
    return;
  }
  element.textContent = message;
  toggleHidden(element, false);
};

export const showToast = (
  root: HTMLElement,
  message: string,
  tone: "success" | "error",
): void => {
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  root.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 3200);
};

export const formatDate = (value: string | null): string => value ? new Date(value).toLocaleString() : "—";
