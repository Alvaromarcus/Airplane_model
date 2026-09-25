# AeroBuilder

**AeroBuilder** is an interactive, web-based application tailored for aeromodelling enthusiasts. It allows you to design RC monoplane aircraft by inputting dimensions, verifying aerodynamic stability in real-time, and generating 1:1 scale templates ready for physical construction (using materials like Depron or Balsa wood).

## Live Demo
*https://aerobuilder-calc.netlify.app/*

## Features
- **Real-Time 2D Visualization:** Instantly see your design changes reflected on a dynamically rendered top and side view, including an accurate Center of Gravity (CG) marker.
- **Flight Assistant (Aerodynamic Consultant):** Automatically calculates key metrics (MAC, CG, Neutral Point, Static Margin, Aspect Ratio) and warns you about potentially unstable or unflyable designs based on proven aerodynamic rules.
- **1:1 PDF Template Export:** Tiling logic that seamlessly splits your aircraft design across multiple standard A4 pages with alignment crosshairs for easy printing, taping, and cutting.
- **Internationalization & Unit Conversion:** Supports both English (EN) and Portuguese (PT-BR) languages, and allows toggling between Centimeters (cm) and Millimeters (mm) while retaining physical scale accuracy.
- **Editable Control Surfaces:** Ailerons/elevons (start, end, chord %), elevator and rudder chord %, with live sizes and sizing checks — shown in 2D, 3D and the PDF.
- **3D Printing (STL export):** Splits the aircraft into sections that fit your printer's build volume, ready for LW-PLA in spiral vase mode, with keyhole spar channels for carbon rods, automatic chord-wise splits for large chords, and a ZIP with a README (slicer settings, parts list, spar lengths, assembly). Component pockets are cut automatically: wing servo pockets, fuselage bays for battery/ESC and receiver/servos (or battery/ESC/receiver bays in a flying wing's centre section).
- **Internal structure & printable fittings:** Carbon spars, servo mounts (wing plate / fuselage tray) and compartment hatches are shown in the 3D x-ray and 2D views and exported as STL (printed in normal mode). Flying wings get a Zagi-style trailing-edge cut-out that moves the pusher motor forward.
- **Weight & Balance:** Estimates the all-up weight (printed LW-PLA shells, carbon spars, motor, prop, ESC, battery, servos, receiver), places the components and pushrods in 2D/3D (x-ray view), and solves the battery position that puts the CG on target — warning when ballast would be needed.
- **Example Projects:** Six checked designs (trainers, sport, motor glider, flying wings) that balance without ballast — load one and adapt it.
- **Flying-wing CG (Hepperle):** Neutral point at 25 % of the MAC at its span station; CG placed by a user-set static margin (2–12 %).
- **Shareable Projects:** "Share" copies a link with the whole design compressed into the URL — it reopens the same aircraft on any device.
- **Project Summary Bar:** Wingspan, wing area, aspect ratio, estimated weight, wing loading, static margin and CG at a glance, colour-coded.
- **Dark Mode Support:** A sleek, toggleable dark mode for comfortable designing in any lighting condition.

## Tech Stack
- **Framework:** React.js (with TypeScript) bootstrapped via Vite.
- **Styling:** TailwindCSS (v3) for rapid, responsive, and themeable UI development.
- **Visualization:** Native HTML5 Canvas API.
- **PDF Generation:** jsPDF for precise, tiled PDF rendering.
- **3D / STL:** three.js + react-three-fiber; STL files zipped with fflate (loaded on demand).
- **Internationalization:** react-i18next.

## How to run locally

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
