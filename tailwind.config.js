/** @type {import('tailwindcss').Config} */
// Tokens de diseño AUREVIA (compartidos por la tienda pública y el centro de control).
// Contrastes verificados (WCAG): tinta 16:1, tinta-suave 4.8:1 sobre crema, terracota 5.8:1 con texto blanco.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Verdes de marca (base)
        bosque: {
          950: '#082017',
          900: '#0e3324',
          800: '#123e2c',
          700: '#134e2e',
          600: '#1f6b43',
          200: '#c2d4cb',
          100: '#e7f5ed',
          50: '#f0fdf4'
        },
        // Tienda pública: blanco y verde (hoja-700 sobre blanco 5.0:1; blanco sobre hoja-700 5.0:1)
        hoja: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16'
        },
        // Superficies cálidas y bordes
        crema: {
          DEFAULT: '#faf8f5',
          50: '#fdfbf7',
          100: '#fbf9f6',
          200: '#f4ede4',
          300: '#e8e2d8',
          400: '#d5c7b5'
        },
        // Texto
        tinta: {
          DEFAULT: '#082017',
          suave: '#5c7367'
        },
        // Acento terracota (moderado) y dorado de la marca
        terracota: {
          DEFAULT: '#a44a31',
          oscuro: '#8a3d28',
          suave: '#f6e5de'
        },
        oro: '#d4af37',
        // Estados (siempre acompañados de ícono o texto)
        exito: { DEFAULT: '#134e2e', fondo: '#dcfce7' },
        aviso: { DEFAULT: '#9a3412', fondo: '#fff7ed' },
        error: { DEFAULT: '#b91c1c', fondo: '#fee2e2' },
        // Paleta histórica (se conserva para no romper pantallas existentes)
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          dark: '#0f291e'
        },
        earth: {
          100: '#f5efe6',
          500: '#8c6239',
          700: '#5c3d1e'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'ui-serif', 'Georgia', 'serif']
      },
      borderRadius: {
        control: '0.875rem', // botones y campos
        tarjeta: '1.5rem'
      },
      boxShadow: {
        suave: '0 1px 2px rgba(8, 32, 23, 0.06), 0 4px 16px rgba(8, 32, 23, 0.06)',
        elevada: '0 12px 32px rgba(8, 32, 23, 0.14)'
      }
    },
  },
  plugins: [],
}
