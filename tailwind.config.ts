import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* ============================================
         SPACING SCALE
         ============================================ */
      spacing: {
        '0.5': 'var(--space-0-5)',
        '1': 'var(--space-1)',
        '1.5': 'var(--space-1-5)',
        '2': 'var(--space-2)',
        '2.5': 'var(--space-2-5)',
        '3': 'var(--space-3)',
        '3.5': 'var(--space-3-5)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)',
        '9': 'var(--space-9)',
        '10': 'var(--space-10)',
        '11': 'var(--space-11)',
        '12': 'var(--space-12)',
        '14': 'var(--space-14)',
        '16': 'var(--space-16)',
        '20': 'var(--space-20)',
        '24': 'var(--space-24)',
        '28': 'var(--space-28)',
        '32': 'var(--space-32)',
        '36': 'var(--space-36)',
        '40': 'var(--space-40)',
        '44': 'var(--space-44)',
        '48': 'var(--space-48)',
        '52': 'var(--space-52)',
        '56': 'var(--space-56)',
        '60': 'var(--space-60)',
        '64': 'var(--space-64)',
        '72': 'var(--space-72)',
        '80': 'var(--space-80)',
        '96': 'var(--space-96)',
      },

      /* ============================================
         TYPOGRAPHY SCALE
         ============================================ */
      fontSize: {
        xs: ['var(--font-size-xs)', { lineHeight: 'var(--line-height-normal)' }],
        sm: ['var(--font-size-sm)', { lineHeight: 'var(--line-height-normal)' }],
        base: ['var(--font-size-base)', { lineHeight: 'var(--line-height-normal)' }],
        lg: ['var(--font-size-lg)', { lineHeight: 'var(--line-height-relaxed)' }],
        xl: ['var(--font-size-xl)', { lineHeight: 'var(--line-height-relaxed)' }],
        '2xl': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-snug)' }],
        '3xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-snug)' }],
        '4xl': ['var(--font-size-4xl)', { lineHeight: 'var(--line-height-tight)' }],
        '5xl': ['var(--font-size-5xl)', { lineHeight: 'var(--line-height-tight)' }],
        '6xl': ['var(--font-size-6xl)', { lineHeight: 'var(--line-height-none)' }],
        '7xl': ['var(--font-size-7xl)', { lineHeight: 'var(--line-height-none)' }],
        '8xl': ['var(--font-size-8xl)', { lineHeight: 'var(--line-height-none)' }],
        '9xl': ['var(--font-size-9xl)', { lineHeight: 'var(--line-height-none)' }],
      },

      lineHeight: {
        none: 'var(--line-height-none)',
        tight: 'var(--line-height-tight)',
        snug: 'var(--line-height-snug)',
        normal: 'var(--line-height-normal)',
        relaxed: 'var(--line-height-relaxed)',
        loose: 'var(--line-height-loose)',
      },

      letterSpacing: {
        tighter: 'var(--letter-spacing-tighter)',
        tight: 'var(--letter-spacing-tight)',
        normal: 'var(--letter-spacing-normal)',
        wide: 'var(--letter-spacing-wide)',
        wider: 'var(--letter-spacing-wider)',
        widest: 'var(--letter-spacing-widest)',
      },

      fontWeight: {
        thin: 'var(--font-weight-thin)',
        extralight: 'var(--font-weight-extralight)',
        light: 'var(--font-weight-light)',
        normal: 'var(--font-weight-normal)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
        extrabold: 'var(--font-weight-extrabold)',
        black: 'var(--font-weight-black)',
      },

      /* ============================================
         BORDER RADIUS
         ============================================ */
      borderRadius: {
        none: 'var(--radius-none)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-default)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)',
      },

      /* ============================================
         SHADOWS
         ============================================ */
      boxShadow: {
        none: 'var(--shadow-none)',
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        inner: 'var(--shadow-inner)',
        // Semantic elevation shadows
        'elevation-low': 'var(--shadow-elevation-low)',
        'elevation-medium': 'var(--shadow-elevation-medium)',
        'elevation-high': 'var(--shadow-elevation-high)',
        'elevation-highest': 'var(--shadow-elevation-highest)',
      },

      /* ============================================
         Z-INDEX SCALE
         ============================================ */
      zIndex: {
        behind: 'var(--z-behind)',
        base: 'var(--z-base)',
        raised: 'var(--z-raised)',
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        overlay: 'var(--z-overlay)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
        toast: 'var(--z-toast)',
      },

      /* ============================================
         TRANSITIONS
         ============================================ */
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
        slowest: 'var(--duration-slowest)',
      },

      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        'stream-glow': {
          '0%, 100%': { boxShadow: '0 0 0 1px hsl(var(--accent-primary) / 0.3), 0 0 8px 0 hsl(var(--accent-primary) / 0.1)' },
          '50%': { boxShadow: '0 0 0 1px hsl(var(--accent-primary) / 0.6), 0 0 16px 2px hsl(var(--accent-primary) / 0.2)' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'live-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.2)' },
        },
      },

      animation: {
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'stream-glow': 'stream-glow 2s ease-in-out infinite',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'live-pulse': 'live-pulse 1.5s ease-in-out infinite',
      },

      transitionTimingFunction: {
        linear: 'var(--ease-linear)',
        in: 'var(--ease-in)',
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        bounce: 'var(--ease-bounce)',
      },

      /* ============================================
         SEMANTIC COLOR TOKENS
         ============================================ */
      colors: {
        // Surface colors
        surface: {
          base: 'hsl(var(--surface-base))',
          raised: 'hsl(var(--surface-raised))',
          elevated: 'hsl(var(--surface-elevated))',
          overlay: 'hsl(var(--surface-overlay))',
          sunken: 'hsl(var(--surface-sunken))',
          interactive: 'hsl(var(--surface-interactive))',
          disabled: 'hsl(var(--surface-disabled))',
        },

        // Text colors
        text: {
          primary: 'hsl(var(--text-primary))',
          secondary: 'hsl(var(--text-secondary))',
          muted: 'hsl(var(--text-muted))',
          disabled: 'hsl(var(--text-disabled))',
          inverse: 'hsl(var(--text-inverse))',
          link: 'hsl(var(--text-link))',
          'link-hover': 'hsl(var(--text-link-hover))',
        },

        // Accent colors (primary brand)
        'accent-primary': {
          DEFAULT: 'hsl(var(--accent-primary))',
          hover: 'hsl(var(--accent-primary-hover))',
          active: 'hsl(var(--accent-primary-active))',
          subtle: 'hsl(var(--accent-primary-subtle))',
          foreground: 'hsl(var(--accent-primary-foreground))',
        },

        // Accent colors (secondary brand)
        'accent-secondary': {
          DEFAULT: 'hsl(var(--accent-secondary))',
          hover: 'hsl(var(--accent-secondary-hover))',
          active: 'hsl(var(--accent-secondary-active))',
          subtle: 'hsl(var(--accent-secondary-subtle))',
          foreground: 'hsl(var(--accent-secondary-foreground))',
        },

        // Status colors
        success: {
          DEFAULT: 'hsl(var(--success))',
          hover: 'hsl(var(--success-hover))',
          subtle: 'hsl(var(--success-subtle))',
          foreground: 'hsl(var(--success-foreground))',
        },

        warning: {
          DEFAULT: 'hsl(var(--warning))',
          hover: 'hsl(var(--warning-hover))',
          subtle: 'hsl(var(--warning-subtle))',
          foreground: 'hsl(var(--warning-foreground))',
        },

        error: {
          DEFAULT: 'hsl(var(--error))',
          hover: 'hsl(var(--error-hover))',
          subtle: 'hsl(var(--error-subtle))',
          foreground: 'hsl(var(--error-foreground))',
        },

        info: {
          DEFAULT: 'hsl(var(--info))',
          hover: 'hsl(var(--info-hover))',
          subtle: 'hsl(var(--info-subtle))',
          foreground: 'hsl(var(--info-foreground))',
        },

        // Border colors
        'border-default': 'hsl(var(--border-default))',
        'border-muted': 'hsl(var(--border-muted))',
        'border-strong': 'hsl(var(--border-strong))',
        'border-focus': 'hsl(var(--border-focus))',
        'border-error': 'hsl(var(--border-error))',
        'border-success': 'hsl(var(--border-success))',

        // Interactive element colors
        interactive: {
          DEFAULT: 'hsl(var(--interactive-default))',
          hover: 'hsl(var(--interactive-hover))',
          active: 'hsl(var(--interactive-active))',
        },

        // Legacy shadcn/ui compatible tokens
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
