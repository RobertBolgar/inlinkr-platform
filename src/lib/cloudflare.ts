// API Client that calls same-origin /api endpoints
class ApiClient {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    
    try {
      // Try to get Clerk token from the window object
      const clerk = (window as any).Clerk;
      
      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    
    return headers;
  }

  async checkUsernameAvailability(username: string): Promise<{ available: boolean; reason?: string }> {
    const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(username)}`);
    return res.json();
  }

  async createLink(linkData: any): Promise<any> {
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(linkData),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to create link');
    }

    return res.json();
  }

  // Always returns an array of links regardless of API response shape
  async getLinksByUserId(_userId: string, includeInactive: boolean = false): Promise<any[]> {
    const url = includeInactive ? '/api/links?include_inactive=true' : '/api/links';
    const res = await fetch(url, {
      headers: await this.getAuthHeaders(),
    });
    const data = await res.json();
    // Ensure we always return an array
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.results)) {
      return data.results;
    }
    if (data && Array.isArray(data.links)) {
      return data.links;
    }
    return [];
  }

  async getLinkVideoStatsByUserId(_userId: string): Promise<any[]> {
    const res = await fetch(`/api/links`, {
      headers: await this.getAuthHeaders(),
    });
    const data = await res.json();
    // Return videoStats if present in response
    if (data && Array.isArray(data.videoStats)) {
      return data.videoStats;
    }
    return [];
  }

  async getLinkById(id: string, options?: { include_metadata?: boolean }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.include_metadata) params.append('include_metadata', 'true');
    const url = `/api/links/${id}${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url, {
      headers: await this.getAuthHeaders(),
    });
    return res.json();
  }

  async updateLink(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/links/${id}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async getClickEventsByLinkIds(linkIds: string[]): Promise<{
    events: any[];
    totalClicks: number;
    bySource: { source: string | null; clicks: number }[];
  }> {
    const res = await fetch('/api/click-events', {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ link_ids: linkIds }),
    });
    const data = await res.json();
    return {
      events: data.events || [],
      totalClicks: data.totalClicks || 0,
      bySource: data.bySource || []
    };
  }

  async getPlacementsByLinkId(linkId: string): Promise<any[]> {
    const res = await fetch(`/api/placements?link_id=${linkId}`, {
      headers: await this.getAuthHeaders(),
    });
    const data = await res.json();
    return data || [];
  }

  async getPlacementsByLinkIds(linkIds: string[]): Promise<Record<string, any[]>> {
    if (linkIds.length === 0) return {};
    const res = await fetch(`/api/placements?link_ids=${linkIds.join(',')}`, {
      headers: await this.getAuthHeaders(),
    });
    const data = await res.json();
    return data.placements_by_link || {};
  }

  async createPlacement(placementData: {
    link_id: number;
    name: string;
    type: string;
    source_code?: string;
    link_usage_id?: number | null;
    youtube_video_id?: string | null;
  }): Promise<any> {
    const res = await fetch('/api/placements', {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(placementData),
    });
    return res.json();
  }

  async deletePlacement(placementId: string): Promise<any> {
    const res = await fetch(`/api/placements?id=${placementId}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    });
    return res.json();
  }

  async updatePlacement(placementId: string, data: {
    youtube_video_id?: string | null;
    link_usage_id?: number | null;
  }): Promise<any> {
    const res = await fetch(`/api/placements?id=${placementId}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  // Link Usages CRUD operations
  async getLinkUsages(linkId?: string, options?: { include_metadata?: boolean }): Promise<any> {
    const params = new URLSearchParams();
    if (linkId) params.append('link_id', linkId);
    if (options?.include_metadata) params.append('include_metadata', 'true');
    const url = `/api/link-usages${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url, {
      headers: await this.getAuthHeaders(),
    });
    return res.json();
  }

  async createLinkUsage(usageData: {
    link_id: number;
    youtube_video_id?: string;
    placement_type?: string;
    placement_name?: string;
    public_code?: string;
    source_code?: string;
  }): Promise<any> {
    const res = await fetch('/api/link-usages', {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(usageData),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to create link usage');
    }

    return res.json();
  }

  async updateLinkUsage(
    id: number,
    usageData: {
      youtube_video_id?: string;
      placement_type?: string;
      placement_name?: string;
      public_code?: string;
      source_code?: string;
      is_active?: number;
    }
  ): Promise<any> {
    const res = await fetch('/api/link-usages', {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ id, ...usageData }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to update link usage');
    }

    return res.json();
  }

  async deactivateLinkUsage(usageId: number): Promise<any> {
    const res = await fetch(`/api/link-usages?id=${usageId}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to deactivate link usage');
    }

    return res.json();
  }
}

// Link type export for TypeScript
export interface Link {
  id: string;
  user_id: string;
  slug: string;
  original_url: string;
  title?: string;
  subtitle?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  placement_count?: number;
  is_system?: number | boolean;
  public_code?: string; // Phase 3: Global smart short code for Free links
}

// User type export for TypeScript
export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  clerk_user_id?: string;
  first_name?: string | null;
  subdomain?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  username_confirmed_by_user?: boolean | number;
  plan?: string;
  subscription_status?: string;
  subscription_current_period_end?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  referral_reward_active?: number | boolean;
  referral_reward_plan?: "pro" | "pro_plus" | null;
  referral_reward_expires_at?: string | null;
  referral_pro_plus_granted?: number | boolean;
  has_founder_access?: number | boolean;
  youtube_avatar_url?: string | null;
  isAdmin?: boolean;
  role?: string;
}

// Export the API client
export const db = new ApiClient();
