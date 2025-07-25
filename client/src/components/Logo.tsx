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
    small: 'h-8 w-8',
    medium: 'h-10 w-10',
    large: 'h-16 w-16'
  };

  const textSizeClasses = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-3xl'
  };

  const logoIconSize = {
    small: 'w-5 h-5',
    medium: 'w-6 h-6',
    large: 'w-10 h-10'
  };

  if (imageError) {
    // Fallback logo using Lucide icon
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className={`${sizeClasses[size]} bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center`}>
          <Trophy className={`${logoIconSize[size]} text-white`} />
        </div>
        {showText && (
          <div className="flex flex-col">
            <h1 className={`${textSizeClasses[size]} font-bold ${textColor}`}>Score Pro</h1>
            {size !== 'small' && (
              <p className="text-xs text-gray-500">Professional Cricket Scoring</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
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
            <p className="text-xs text-gray-500">Professional Cricket Scoring</p>
          )}
        </div>
      )}
    </div>
  );
}