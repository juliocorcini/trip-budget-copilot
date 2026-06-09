export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Manrope', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                surface: {
                    DEFAULT: 'var(--surface)',
                    container: 'var(--surface-container)',
                    high: 'var(--surface-container-high)',
                    deep: 'var(--surface-deep)',
                },
                primary: {
                    DEFAULT: 'var(--primary)',
                    dim: 'var(--primary-dim)',
                    subtle: 'var(--primary-subtle)',
                },
                'on-surface': {
                    DEFAULT: 'var(--on-surface)',
                    dim: 'var(--on-surface-dim)',
                    faint: 'var(--on-surface-faint)',
                    mute: 'var(--on-surface-mute)',
                },
                success: 'var(--success)',
                warning: 'var(--warning)',
                error: 'var(--error)',
            },
        },
    },
    plugins: [],
};
