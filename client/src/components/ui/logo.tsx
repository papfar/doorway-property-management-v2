import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ className = "", size = 'md', showText = true }: LogoProps) {
  const dimensions = {
    sm: { width: 120, height: 32, iconSize: 28, fontSize: '18px' },
    md: { width: 180, height: 48, iconSize: 42, fontSize: '28px' },
    lg: { width: 240, height: 64, iconSize: 56, fontSize: '36px' }
  };
  
  const { width, height, iconSize, fontSize } = dimensions[size];
  
  return (
    <div className={`flex items-center ${className}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Door frame - outer rectangle */}
        <rect
          x="10"
          y="10"
          width="80"
          height="80"
          fill="currentColor"
          className="text-gray-800 dark:text-white"
        />
        
        {/* Door opening - inner rectangle */}
        <rect
          x="20"
          y="20"
          width="50"
          height="70"
          fill="white"
          className="dark:fill-gray-900"
        />
        
        {/* Door panel - partially open door */}
        <path
          d="M20 20 L55 20 L65 30 L65 90 L20 90 Z"
          fill="currentColor"
          className="text-gray-600 dark:text-gray-400"
        />
        
        {/* Door handle */}
        <circle
          cx="58"
          cy="55"
          r="3"
          fill="white"
          className="dark:fill-gray-900"
        />
        
        {/* Door shadow/depth line */}
        <line
          x1="55"
          y1="20"
          x2="65"
          y2="30"
          stroke="currentColor"
          strokeWidth="2"
          className="text-gray-400 dark:text-gray-600"
        />
      </svg>
      
      {showText && (
        <span
          className="ml-3 font-bold text-gray-800 dark:text-white tracking-wide"
          style={{ fontSize }}
        >
          DOORWAY
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ className = "", size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return <Logo className={className} size={size} showText={false} />;
}