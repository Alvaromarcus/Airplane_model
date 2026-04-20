# AeroBuilder

**AeroBuilder** is an interactive, web-based application tailored for aeromodelling enthusiasts. It allows you to design RC monoplane aircraft by inputting dimensions, verifying aerodynamic stability in real-time, and generating 1:1 scale templates ready for physical construction (using materials like Depron or Balsa wood).

## 🚀 Live Demo
*https://aerobuilder-calc.netlify.app/*

## ✨ Features
- **Real-Time 2D Visualization:** Instantly see your design changes reflected on a dynamically rendered top and side view, including an accurate Center of Gravity (CG) marker.
- **Flight Assistant (Aerodynamic Consultant):** Automatically calculates key metrics (MAC, CG, Neutral Point, Static Margin, Aspect Ratio) and warns you about potentially unstable or unflyable designs based on proven aerodynamic rules.
- **1:1 PDF Template Export:** Tiling logic that seamlessly splits your aircraft design across multiple standard A4 pages with alignment crosshairs for easy printing, taping, and cutting.
- **Internationalization & Unit Conversion:** Supports both English (EN) and Portuguese (PT-BR) languages, and allows toggling between Centimeters (cm) and Millimeters (mm) while retaining physical scale accuracy.
- **Dark Mode Support:** A sleek, toggleable dark mode for comfortable designing in any lighting condition.

## 🛠 Tech Stack
- **Framework:** React.js (with TypeScript) bootstrapped via Vite.
- **Styling:** TailwindCSS (v3) for rapid, responsive, and themeable UI development.
- **Visualization:** Native HTML5 Canvas API.
- **PDF Generation:** jsPDF for precise, tiled PDF rendering.
- **Internationalization:** react-i18next.

## 💻 How to run locally

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd aerobuilder
   ```

2. **Install dependencies:**
   Make sure you have Node.js installed, then run:
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open your browser and navigate to the local URL provided in the terminal (typically `http://localhost:5173/`).

5. **Build for production:**
   To create a production-ready build, run:
   ```bash
   npm run build
   ```
   You can then preview the build with:
   ```bash
   npm run preview
   ```
