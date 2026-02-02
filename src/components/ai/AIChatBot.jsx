import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Draggable from 'react-draggable';
import { X, Minus, Maximize2, Send, MessageSquare, Settings as SettingsIcon } from 'lucide-react';
import aiService from '../../services/aiService';
import analyticsService from '../../services/analyticsService';

const AIChatBot = ({ viewer, onDataClick, isOpen, onClose, isFloating = true }) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', text: "Hello! I'm your BIM assistant. Ask me to find or filter elements in the 3D model using natural language." }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [showKeyInput, setShowKeyInput] = useState(!aiService.getApiKey());
    const [apiKey, setApiKey] = useState(aiService.getApiKey());
    const [availableProps, setAvailableProps] = useState([]);
    const [isMinimized, setIsMinimized] = useState(false);
    const scrollRef = useRef(null);
    const nodeRef = useRef(null);

    useEffect(() => {
        if (viewer) {
            analyticsService.getModelPropertyNames(viewer).then(setAvailableProps);
        }
    }, [viewer]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSaveKey = () => {
        aiService.setApiKey(apiKey);
        setShowKeyInput(false);
        setMessages(prev => [...prev, { role: 'assistant', text: "API Key saved! How can I help you today?" }]);
    };

    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!inputValue.trim() || loading) return;

        const userMsg = inputValue.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInputValue('');
        setLoading(true);

        try {
            const result = await aiService.queryModel(userMsg, availableProps);

            setMessages(prev => [...prev, {
                role: 'assistant',
                text: result.explanation,
                filters: result.filters
            }]);

            if (result.filters && result.filters.length > 0 && viewer) {
                // Execute the filter found by AI
                // Execute the filter found by AI using Smart Search
                const matchedIds = await analyticsService.searchElements(
                    viewer,
                    result.filters
                );

                if (matchedIds.length > 0) {
                    onDataClick(matchedIds);

                    // Isolate them visually
                    viewer.isolate(matchedIds);
                    viewer.fitToView(matchedIds);

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        text: `Found ${matchedIds.length} elements matching your criteria.`
                    }]);
                } else {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        text: "I found the logic, but no elements in the model match those criteria."
                    }]);
                }
            }
        } catch (error) {
            let errorMsg = `Error: ${error.message}`;

            // Debug: List available models if not found
            if (error.message.includes('not found') || error.message.includes('404')) {
                try {
                    const models = await aiService.getAvailableModels();
                    if (models.length > 0) {
                        errorMsg += `\n\nAvailable models for your key:\n${models.join(', ')}`;
                    }
                } catch (e) {
                    // Ignore debug error
                }
            }

            setMessages(prev => [...prev, { role: 'assistant', text: errorMsg }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen && isFloating) return null;

    const chatContent = (
        <motion.div
            initial={isFloating ? { opacity: 0, scale: 0.9, y: 20 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={isFloating ? { opacity: 0, scale: 0.9, y: 20 } : { opacity: 0, y: 20 }}
            style={{
                height: isMinimized ? 'auto' : (isFloating ? '500px' : '100%'),
                width: isFloating ? '380px' : '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(13, 17, 23, 0.95)',
                backdropFilter: 'blur(12px)',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: isFloating ? '0 20px 50px rgba(0,0,0,0.5)' : 'none',
                position: isFloating ? 'fixed' : 'relative',
                right: isFloating ? '24px' : 'auto',
                bottom: isFloating ? '24px' : 'auto',
                zIndex: 10000,
                color: 'white'
            }}
        >
            {/* Header / Drag Handle */}
            <div
                className="chat-header"
                style={{
                    padding: '16px',
                    background: 'rgba(29, 185, 84, 0.15)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: isFloating ? 'move' : 'default'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.025em' }}>BIM ASSISTANT</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-primary)', opacity: 0.8 }}>Powered by Gemini 1.5</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setShowKeyInput(!showKeyInput)}
                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                        title="Settings"
                    >
                        <SettingsIcon size={16} />
                    </button>
                    {isFloating && (
                        <>
                            <button
                                onClick={onClose}
                                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                                title="Minimize to bubble"
                            >
                                <Minus size={16} />
                            </button>
                            <button
                                onClick={onClose}
                                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Chat Messages */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    background: 'rgba(10, 10, 15, 0.4)'
                }}
            >
                <AnimatePresence>
                    {showKeyInput && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '16px',
                                borderRadius: '12px',
                                marginBottom: '8px',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Gemini API Key</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter API Key..."
                                    style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '12px' }}
                                />
                                <button
                                    onClick={handleSaveKey}
                                    className="px-4 py-2 bg-[var(--color-primary)] text-black rounded-lg text-xs font-bold hover:bg-opacity-90 transition-all"
                                >SAVE</button>
                            </div>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: 'var(--color-primary)', marginTop: '10px', display: 'inline-block', textDecoration: 'none' }}>Get a free key here →</a>
                        </motion.div>
                    )}
                </AnimatePresence>

                {messages.map((msg, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            padding: '12px 16px',
                            background: msg.role === 'user' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)',
                            borderRadius: msg.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                            color: msg.role === 'user' ? '#000' : 'white',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                            border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                        }}
                    >
                        {msg.text}
                        {msg.filters && msg.filters.length > 0 && (
                            <div style={{ marginTop: '10px', fontSize: '11px', opacity: 0.7, borderLeft: '2px solid rgba(255,255,255,0.3)', paddingLeft: '10px', fontStyle: 'italic' }}>
                                Searching: {msg.filters[0].attribute} {msg.filters[0].operator} {msg.filters[0].value}
                            </div>
                        )}
                    </motion.div>
                ))}

                {loading && (
                    <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>
                        <div className="spinner-sm"></div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form
                onSubmit={handleSendMessage}
                style={{
                    padding: '16px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    gap: '10px',
                    background: 'rgba(13, 17, 23, 0.8)'
                }}
            >
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask BIM assistant..."
                    style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '24px',
                        padding: '10px 18px',
                        color: 'white',
                        fontSize: '13px',
                        outline: 'none'
                    }}
                />
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={loading || !inputValue.trim()}
                    style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        border: 'none',
                        color: '#000',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Send size={18} />
                </motion.button>
            </form>
        </motion.div>
    );

    if (isFloating) {
        return (
            <Draggable
                nodeRef={nodeRef}
                handle=".chat-header"
                bounds="body"
            >
                <div
                    ref={nodeRef}
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        right: '24px',
                        zIndex: 10000
                    }}
                >
                    {chatContent}
                </div>
            </Draggable>
        );
    }

    return chatContent;
};

export default AIChatBot;
