/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#f6f7fb', surface: '#ffffff', foreground: '#101828',
        muted: '#f8f9fc', 'muted-foreground': '#667085', border: '#e1e6ef',
        input: '#cfd5df', ring: '#4f46e5', primary: '#172554',
        'primary-foreground': '#ffffff', secondary: '#eef2ff',
        'secondary-foreground': '#4338ca', destructive: '#b42318',
        'destructive-foreground': '#ffffff', success: '#239b56',
        'success-foreground': '#ffffff', warning: '#b54708',
        'warning-foreground': '#ffffff',
      },
      borderRadius: { sm: '8px', md: '10px', lg: '14px', xl: '16px' },
      spacing: { touch: '44px' },
    },
  },
  future: { hoverOnlyWhenSupported: true },
}
