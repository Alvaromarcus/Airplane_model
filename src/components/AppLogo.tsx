export default function AppLogo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <svg
        width="32" height="32" viewBox="0 0 32 32"
        fill="none" xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Fuselage */}
        <ellipse cx="16" cy="16" rx="2.5" ry="11"
                 className="fill-blue-600 dark:fill-blue-400" />
        {/* Main wing */}
        <path d="M16 13 L2 18 L4 20 L16 17 L28 20 L30 18 Z"
              className="fill-blue-500 dark:fill-blue-300" />
        {/* Horizontal stabilizer */}
        <path d="M16 24 L9 27 L10 28 L16 26 L22 28 L23 27 Z"
              className="fill-blue-400 dark:fill-blue-200" />
        {/* Vertical stabilizer dot */}
        <rect x="15" y="5" width="2" height="5" rx="1"
              className="fill-blue-700 dark:fill-blue-300" />
      </svg>
      <div className="flex flex-col leading-tight">
        <span className="text-lg font-bold text-gray-800 dark:text-white
                         tracking-tight">
          AeroBuilder
        </span>
        <span className="text-xs font-medium text-blue-600
                         dark:text-blue-400 -mt-0.5 tracking-wider">
          CALC
        </span>
      </div>
    </div>
  );
}