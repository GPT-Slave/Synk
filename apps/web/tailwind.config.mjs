/** @type {import("tailwindcss").Config} */
const config = {
  darkMode: "class",
  theme: {
    extend: {
      borderRadius: {
        sm: "10px",
        md: "12px",
        lg: "14px",
        xl: "14px",
        "2xl": "14px",
        "3xl": "14px",
      },
      boxShadow: {
        xs: "0 1px 2px rgb(0 0 0 / 0.24)",
        sm: "0 8px 24px -16px rgb(0 0 0 / 0.62)",
        md: "0 18px 48px -26px rgb(0 0 0 / 0.72)",
        lg: "0 28px 80px -34px rgb(0 0 0 / 0.82)",
        glow: "0 0 34px -12px oklch(0.86 0.24 145 / 0.58)",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
        16: "64px",
      },
      transitionDuration: {
        180: "180ms",
        220: "220ms",
      },
    },
  },
};

export default config;
