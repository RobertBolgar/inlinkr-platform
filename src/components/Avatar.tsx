
interface AvatarProps {
  user?: {
    avatarUrl?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    displayName?: string;
    email?: string;
  } | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ user, size = 'md', className = '' }: AvatarProps) {
  const getInitials = () => {
    if (!user) return '?';
    
    // Try display name first
    if (user.displayName) {
      const names = user.displayName.trim().split(' ');
      if (names.length >= 2) {
        return names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase();
      }
      return user.displayName[0].toUpperCase();
    }
    
    // Try first name + last name
    if (user.firstName) {
      const first = user.firstName[0].toUpperCase();
      const last = user.lastName ? user.lastName[0].toUpperCase() : '';
      return first + last;
    }
    
    // Try username
    if (user.username) {
      return user.username[0].toUpperCase();
    }
    
    // Try email
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    
    return '?';
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-8 h-8 text-xs';
      case 'md':
        return 'w-10 h-10 text-sm';
      case 'lg':
        return 'w-12 h-12 text-base';
      case 'xl':
        return 'w-16 h-16 text-lg';
      default:
        return 'w-10 h-10 text-sm';
    }
  };

  // Single source of truth for avatar URL
  const avatarUrl = user?.avatarUrl || null;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        className={`${getSizeClasses()} rounded-full object-cover border-2 border-gray-700 ${className}`}
        onError={(e) => {
          // Fallback to initials if image fails to load
          e.currentTarget.style.display = 'none';
          if (e.currentTarget.nextSibling) {
            (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
          }
        }}
      />
    );
  }

  return (
    <div
      className={`${getSizeClasses()} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium border-2 border-gray-700 ${className}`}
    >
      {getInitials()}
    </div>
  );
}
