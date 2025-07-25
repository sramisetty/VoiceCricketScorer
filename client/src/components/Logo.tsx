import { useState } from 'react';
import { Trophy } from 'lucide-react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  textColor?: string;
  className?: string;
}

export default function Logo({ 
  size = 'medium', 
  showText = true, 
  textColor = 'text-gray-900',
  className = '' 
}: LogoProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    small: 'h-6 w-6 sm:h-8 sm:w-8',
    medium: 'h-8 w-8 sm:h-10 sm:w-10',
    large: 'h-12 w-12 sm:h-16 sm:w-16'
  };

  const textSizeClasses = {
    small: 'text-base sm:text-lg',
    medium: 'text-lg sm:text-xl',
    large: 'text-2xl sm:text-3xl'
  };

  const logoIconSize = {
    small: 'w-4 h-4 sm:w-5 sm:h-5',
    medium: 'w-5 h-5 sm:w-6 sm:h-6',
    large: 'w-8 h-8 sm:w-10 sm:h-10'
  };

  if (imageError) {
    // Fallback logo using Lucide icon
    return (
      <div className={`flex items-center space-x-2 sm:space-x-3 ${className}`}>
        <div className={`${sizeClasses[size]} bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-md`}>
          <Trophy className={`${logoIconSize[size]} text-white`} />
        </div>
        {showText && (
          <div className="flex flex-col">
            <h1 className={`${textSizeClasses[size]} font-bold ${textColor}`}>Score Pro</h1>
            {size !== 'small' && (
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Professional Cricket Scoring</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 sm:space-x-3 ${className}`}>
      <img 
        src="/logo.svg" 
        alt="Score Pro" 
        className={`${sizeClasses[size]} w-auto`}
        onError={() => {
          console.error('Logo failed to load from /logo.svg, showing fallback');
          setImageError(true);
        }}
        onLoad={() => {
          console.log('Logo loaded successfully from /logo.svg');
        }}
      />
      {showText && (
        <div className="flex flex-col">
          <h1 className={`${textSizeClasses[size]} font-bold ${textColor}`}>Score Pro</h1>
          {size !== 'small' && (
            <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Professional Cricket Scoring</p>
          )}
        </div>
      )}
    </div>
  );
}