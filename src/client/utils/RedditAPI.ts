import {
    BuyItemResponse,
    DebugNotesResponse,
    DebugResetShopResponse,
    ListenTrackResponse,
    PianoEvent,
    PostInfoResponse,
    PublishTrackResponse,
    RemoveTrackResponse,
    SaveTrackResponse,
    SubmitRatingResponse,
    UserResponse,
    UserTracksResponse,
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

    saveTrack: (body: {
        name: string;
        timeline: PianoEvent[];
        instrumentId: string;
        durationMs: number;
        noteCount: number;
    }) =>
        apiRequest<SaveTrackResponse>('/api/save-track', 'POST', body),

    deleteTrack: (body: { trackId: string }) =>
        apiRequest<RemoveTrackResponse>('/api/delete-track', 'POST', body),

    publishTrack: (body: { trackId: string }) =>
        apiRequest<PublishTrackResponse>('/api/publish-track', 'POST', body),

    listenTrack: (body: { trackId: string }) =>
        apiRequest<ListenTrackResponse>('/api/listen-track', 'POST', body),

    rateTrack: (body: { trackId: string; rating: number }) =>
        apiRequest<SubmitRatingResponse>('/api/rate-track', 'POST', body),

    debugAddNotes: () =>
        apiRequest<DebugNotesResponse>('/api/debug/add-notes', 'POST'),

    debugRemoveNotes: () =>
        apiRequest<DebugNotesResponse>('/api/debug/remove-notes', 'POST'),

    debugResetShop: () =>
        apiRequest<DebugResetShopResponse>('/api/debug/reset-shop', 'POST'),
};

async function apiRequest<T>(
    url: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>
): Promise<T> {
    window.dispatchEvent(new CustomEvent('SHOW_PHASER_LOADER'));

    try {
        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };

        if (body) options.body = JSON.stringify(body);

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Server error: ${response.status}` }));
            const message = typeof errorData.message === 'string'
                ? errorData.message
                : `Server error: ${response.status}`;
            throw new Error(message);
        }

        const data: T = await response.json();
        return data;
    } finally {
        window.dispatchEvent(new CustomEvent('HIDE_PHASER_LOADER'));
    }
}
