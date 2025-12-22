import { useEffect, useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// Class emoji mapping - same as PlayerProfileCard
const CLASS_EMOJIS: Record<string, string> = {
  fighter: "⚔️",
  warrior: "⚔️",
  tanker: "🛡️",
  mage: "🔮",
  assassin: "🗡️",
  ranger: "🏹",
  healer: "💚",
  hunter: "🏹",
  necromancer: "💀",
  default: "⚔️",
};

interface HunterAvatarProps {
  avatar?: string | null;
  hunterName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-20 w-20',
};

const emojiSizeClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

export const HunterAvatar = ({
  avatar,
  hunterName,
  size = 'md',
  className,
  showBorder = true,
}: HunterAvatarProps) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [avatar]);

  const normalized = (avatar || '').trim();
  const normalizedLower = normalized.toLowerCase();

  // Treat base64, absolute URLs, and common absolute-path uploads as images
  const isCustomImage =
    normalized.startsWith('data:') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('/');

  const classEmoji = CLASS_EMOJIS[normalizedLower] || CLASS_EMOJIS.default;
  const fallback = normalizedLower && CLASS_EMOJIS[normalizedLower]
    ? CLASS_EMOJIS[normalizedLower]
    : classEmoji;

  return (
    <Avatar
      className={cn(
        sizeClasses[size],
        showBorder && 'border-2 border-primary/30',
        'flex-shrink-0',
        className
      )}
    >
      {isCustomImage && !imageError ? (
        <AvatarImage
          src={normalized}
          alt={hunterName}
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          'bg-primary/20 text-primary font-bold flex items-center justify-center leading-none select-none',
          emojiSizeClasses[size]
        )}
      >
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
};
