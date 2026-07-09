// Helper function for UI name priority
// display_name → first_name → Clerk/Google first name → email fallback

export function getDisplayName(user: any): string {
  if (!user) return "Creator";
  
  // Priority 1: display_name (user's chosen display name)
  if (user.display_name && user.display_name.trim()) {
    return user.display_name.trim();
  }
  
  // Priority 2: first_name (from database)
  if (user.first_name && user.first_name.trim()) {
    return user.first_name.trim();
  }
  
  // Priority 3: Clerk/Google first name (from Clerk user object)
  if (user.clerkUser?.firstName && user.clerkUser.firstName.trim()) {
    return user.clerkUser.firstName.trim();
  }
  
  // Priority 4: email fallback (extract name before @)
  if (user.email) {
    const emailName = user.email.split('@')[0];
    if (emailName && emailName.trim()) {
      return emailName.trim();
    }
  }
  
  // Final fallback
  return "Creator";
}
