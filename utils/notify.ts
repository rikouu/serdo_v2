type ToastType = 'success' | 'error' | 'info'

let toastHandler: ((text: string, type: ToastType) => void) | null = null
let overlayHandler: ((show: boolean, text?: string) => void) | null = null
let resultHandler: ((payload: { title: string; success?: Array<{ id: string; name?: string; note?: string }>; failed?: Array<{ id: string; name?: string; error: string }>; subtitle?: string }) => void) | null = null
let progressStartHandler: ((payload: { title: string; items: Array<{ id: string; name?: string }>; subtitle?: string }) => void) | null = null
let progressUpdateHandler: ((id: string, status: 'pending' | 'success' | 'error', note?: string) => void) | null = null
let progressFinishHandler: (() => void) | null = null

export function registerToast(handler: (text: string, type: ToastType) => void) { toastHandler = handler }
export function registerOverlay(handler: (show: boolean, text?: string) => void) { overlayHandler = handler }
export function registerResults(handler: (payload: { title: string; success?: Array<{ id: string; name?: string; note?: string }>; failed?: Array<{ id: string; name?: string; error: string }>; subtitle?: string }) => void) { resultHandler = handler }
export function registerProgressStart(handler: (payload: { title: string; items: Array<{ id: string; name?: string }>; subtitle?: string }) => void) { progressStartHandler = handler }
export function registerProgressUpdate(handler: (id: string, status: 'pending' | 'success' | 'error', note?: string) => void) { progressUpdateHandler = handler }
export function registerProgressFinish(handler: () => void) { progressFinishHandler = handler }

export function showToast(text: string, type: ToastType = 'info') { try { toastHandler && toastHandler(text, type) } catch {} }
export function showOverlay(text: string) { try { overlayHandler && overlayHandler(true, text) } catch {} }
export function hideOverlay() { try { overlayHandler && overlayHandler(false) } catch {} }
export function showResults(payload: { title: string; success?: Array<{ id: string; name?: string; note?: string }>; failed?: Array<{ id: string; name?: string; error: string }>; subtitle?: string }) { try { resultHandler && resultHandler(payload) } catch {} }
export function startProgress(title: string, items: Array<{ id: string; name?: string }>, subtitle?: string) { try { progressStartHandler && progressStartHandler({ title, items, subtitle }) } catch {} }
export function updateProgress(id: string, status: 'pending' | 'success' | 'error', note?: string) { try { progressUpdateHandler && progressUpdateHandler(id, status, note) } catch {} }
export function finishProgress() { try { progressFinishHandler && progressFinishHandler() } catch {} }
