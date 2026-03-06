import { useEffect, useRef, useState } from 'react';
import { PopupWindowManager } from './PopupWindowManager.js';

/**
 * usePopupChannel — React hook that wraps PopupWindowManager for use in
 * functional components.
 *
 * The popup is NOT opened automatically on mount. Call the returned `open()`
 * function to open it (e.g., from a button click handler).
 *
 * The BroadcastChannel is created when `open()` is called and closed on unmount
 * to prevent memory leaks.
 *
 * @param {string}   url         - Popup page URL (passed to PopupWindowManager.open)
 * @param {string}   channelName - BroadcastChannel name
 * @param {function} onMessage   - Callback invoked for every incoming message from the popup
 *                                 Signature: (msg: { type: string, payload: object }) => void
 *
 * @returns {{ open: () => boolean, send: (msg: object) => void, close: () => void, isOpen: boolean }}
 *
 * Example:
 * ```jsx
 * const { open, send, close, isOpen } = usePopupChannel(
 *   'spectrogram-popup.html?panel=filter&channel=spectrogram-filter',
 *   'spectrogram-filter',
 *   (msg) => {
 *     if (msg.type === 'FILTER_APPLY') handleApply();
 *   }
 * );
 *
 * return (
 *   <button onClick={open} disabled={isOpen}>
 *     {isOpen ? 'Filter Panel Open' : 'Open Filter Panel'}
 *   </button>
 * );
 * ```
 */
export function usePopupChannel(url, channelName, onMessage) {
  const managerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  // Keep onMessage ref stable so the effect closure doesn't go stale
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const manager = new PopupWindowManager();
    managerRef.current = manager;

    manager.on('message', (msg) => {
      if (onMessageRef.current) onMessageRef.current(msg);
    });

    manager.on('closed', () => {
      setIsOpen(false);
    });

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, []); // intentionally empty — create/destroy once with the component

  const open = () => {
    const manager = managerRef.current;
    if (!manager) return false;
    const opened = manager.open(url, channelName);
    if (opened) setIsOpen(true);
    return opened;
  };

  const send = (message) => {
    if (managerRef.current) managerRef.current.send(message);
  };

  const close = () => {
    if (managerRef.current) managerRef.current.close();
  };

  return { send, isOpen, open, close };
}

export default usePopupChannel;
