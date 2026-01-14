import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aiService from '../../services/aiService';
import analyticsService from '../../services/analyticsService';

const AIChatBot = ({ viewer, onDataClick }) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', text: "Hello! I'm your BIM assistant. Ask me to find or filter elements in the 3D model using natural language." }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [showKeyInput, setShowKeyInput] = useState(!aiService.getApiKey());
    const [apiKey, setApiKey] = useState(aiService.getApiKey());
    const [availableProps, setAvailableProps] = useState([]);
    const scrollRef = useRef(null);

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

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-bg-elevated)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)'
            }}
        >
            {/* Header */}
            <div style={{
                padding: 'var(--spacing-md)',
                background: 'rgba(29, 185, 84, 0.1)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span style={{ fontSize: '20px' }}>🤖</span>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>BIM Assistant</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-primary)' }}>Powered by Gemini 1.5</div>
                    </div>
                </div>
                <button
                    onClick={() => setShowKeyInput(true)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-subdued)', cursor: 'pointer', fontSize: '12px' }}
                >
                    ⚙️ API Key
                </button>
            </div>

            {/* Chat Messages */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 'var(--spacing-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-md)'
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
                                padding: '12px',
                                borderRadius: '8px',
                                marginBottom: '12px'
                            }}
                        >
                            <label style={{ fontSize: '10px', color: 'var(--color-text-subdued)', display: 'block', marginBottom: '8px' }}>GOOGLE GEMINI API KEY</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter API Key..."
                                    style={{ flex: 1, padding: '8px', background: '#000', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white', fontSize: '12px' }}
                                />
                                <button
                                    onClick={handleSaveKey}
                                    className="btn btn-primary"
                                    style={{ padding: '4px 12px', fontSize: '12px' }}
                                >Save</button>
                            </div>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: 'var(--color-primary)', marginTop: '8px', display: 'inline-block' }}>Get a free key here</a>
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
                            padding: '10px 14px',
                            background: msg.role === 'user' ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                            borderRadius: msg.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                            color: msg.role === 'user' ? '#000' : 'white',
                            fontSize: '13px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    >
                        {msg.text}
                        {msg.filters && msg.filters.length > 0 && (
                            <div style={{ marginTop: '8px', fontSize: '11px', opacity: 0.8, borderLeft: '2px solid rgba(255,255,255,0.3)', paddingLeft: '8px' }}>
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
                    padding: 'var(--spacing-md)',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    gap: 'var(--spacing-sm)'
                }}
            >
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Search model (e.g. 'find all steel doors')..."
                    style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '20px',
                        padding: '10px 16px',
                        color: 'white',
                        fontSize: '13px',
                        outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                />
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={loading || !inputValue.trim()}
                    style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        border: 'none',
                        color: '#000',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px'
                    }}
                >
                    ✈️
                </motion.button>
            </form>
        </motion.div>
    );
};

export default AIChatBot;
