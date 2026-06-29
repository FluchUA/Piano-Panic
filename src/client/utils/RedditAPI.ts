import { 
    PianoEvent, 
    UserResponse, 
    PostInfoResponse, 
    BuyItemResponse, 
    UserTracksResponse,
    SaveTrackResponse,
    RemoveTrackResponse,
    PublishTrackResponse,
} from '../../shared/api';

export const RedditAPI = {
    getUser: () => 
        apiRequest<UserResponse>('/api/get-user'),
    
    getPostInfo: () => 
        apiRequest<PostInfoResponse>('/api/post-info'),
    
    buyItem: (itemId: string) => 
        apiRequest<BuyItemResponse>('/api/buy-item', 'POST', { itemId }),

    getUserTracks: (page: number, limit: number) => 
        apiRequest<UserTracksResponse>(`/api/user-tracks?page=${page}&limit=${limit}`),
    
    saveTrack: (body: { name: string; timeline: PianoEvent[]; instrumentId: string }) => 
        apiRequest<SaveTrackResponse>('/api/save-track', 'POST', body),

    deleteTrack: (body: { instrumentId: string }) => 
        apiRequest<RemoveTrackResponse>('/api/delete-track', 'POST', body),
    
    publishTrack: (body: { trackId: string; }) => 
        apiRequest<PublishTrackResponse>('/api/publish-track', 'POST', body),

    rateTrack: (body: { rate: number }) => 
        apiRequest<RemoveTrackResponse>('/api/rate-track', 'POST', body),
};

// A universal internal request handler with a loader
async function apiRequest<T>(url: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<T> {
    window.dispatchEvent(new CustomEvent('SHOW_PHASER_LOADER'));

    try {
        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        return await response.json() as T;
    } finally {
        window.dispatchEvent(new CustomEvent('HIDE_PHASER_LOADER'));
    }
}