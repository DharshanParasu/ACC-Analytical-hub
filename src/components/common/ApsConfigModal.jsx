import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertTriangle, Key, Copy, Check } from 'lucide-react';
import apsService from '../../services/apsService';

const ApsConfigModal = ({ isOpen, onClose }) => {
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [callbackUrl, setCallbackUrl] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Load existing custom credentials or defaults from service (if exposed, but we stick to localStorage for "custom" inputs)
            const storedId = localStorage.getItem('custom_aps_client_id');
            const storedSecret = localStorage.getItem('custom_aps_client_secret');

            setClientId(storedId || '');
            setClientSecret(storedSecret || '');

            // Allow custom callback URL, default to user preference or current origin
            const storedCallback = localStorage.getItem('custom_aps_callback_url');
            setCallbackUrl(storedCallback || 'https://localhost:8080/auth/callback/');
        }
    }, [isOpen]);

    const handleSave = () => {
        // Simple validation
        if (!clientId || !clientSecret) {
            alert('Please enter both Client ID and Client Secret.');
            return;
        }

        // Remove ALL whitespace (not just trim) as credentials never contain spaces
        const safeClientId = clientId.replace(/\s+/g, '');
        const safeClientSecret = clientSecret.replace(/\s+/g, '');
        const safeCallback = callbackUrl.trim();

        if (safeClientId.length > 32) {
            alert('Your Client ID seems too long (standard is 32 characters). Please ensure you haven\'t accidentally pasted the Client Secret into the ID field.');
            return;
        }

        localStorage.setItem('custom_aps_client_id', safeClientId);
        localStorage.setItem('custom_aps_client_secret', safeClientSecret);
        localStorage.setItem('custom_aps_callback_url', safeCallback);

        // Visual feedback before reload
        const btn = document.getElementById('save-btn');
        if (btn) btn.innerText = 'Saved! Reloading...';

        setTimeout(() => {
            window.location.reload();
        }, 1000);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(callbackUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-lg bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Key className="w-5 h-5 text-lime-400" />
                                APS Configuration
                            </h2>
                            <button onClick={onClose} className="p-1 hover:bg-[var(--color-hover)] rounded-full transition-colors">
                                <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">

                            {/* Warning */}
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3 text-yellow-200/90 text-sm leading-relaxed">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-yellow-400" />
                                <div>
                                    <strong>Security Notice:</strong> Credentials are stored in your browser's LocalStorage. This is safe for local/personal use, but do not use this on a public shared computer.
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                                        Client ID
                                    </label>
                                    <input
                                        type="text"
                                        value={clientId}
                                        onChange={(e) => setClientId(e.target.value)}
                                        placeholder="Paste your Client ID"
                                        className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-base)] focus:border-lime-400 focus:outline-none transition-colors font-mono text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                                        Client Secret
                                    </label>
                                    <input
                                        type="password"
                                        value={clientSecret}
                                        onChange={(e) => setClientSecret(e.target.value)}
                                        placeholder="Paste your Client Secret"
                                        className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-base)] focus:border-lime-400 focus:outline-none transition-colors font-mono text-sm"
                                    />
                                </div>
                            </div>

                            {/* Callback Info (Now Editable) */}
                            <div className="p-4 bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border)]">
                                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                                    Callback URL
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={callbackUrl}
                                        onChange={(e) => setCallbackUrl(e.target.value)}
                                        className="flex-1 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--color-text-base)] focus:border-lime-400 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleCopy}
                                        className="p-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-hover)] transition-colors relative"
                                        title="Copy to clipboard"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-[var(--color-text-muted)]" />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                                    This URL must exactly match what you registered in the APS portal.
                                </p>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-6 pt-0 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-base)] hover:bg-[var(--color-hover)] transition-colors font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                id="save-btn"
                                onClick={handleSave}
                                className="px-5 py-2.5 rounded-xl bg-lime-400 text-black font-bold hover:bg-lime-500 transition-colors shadow-lg shadow-lime-400/20 flex items-center gap-2 text-sm"
                            >
                                <Save className="w-4 h-4" />
                                Save & Reload
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ApsConfigModal;
