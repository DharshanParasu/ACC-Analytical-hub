import { useTheme } from '../../context/ThemeContext';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="btn btn-icon"
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-base)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
        >
            {theme === 'light' ? '🌙' : '☀️'}
        </button>
    );
};

export default ThemeToggle;
