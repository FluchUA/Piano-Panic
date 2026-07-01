import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import { createPost } from '../core/post';
import { AppMode, InstrumentId, PianoEventType, ShopItem } from '../../shared/api';
import { PUBLISH_REWARD, RATING_REWARD, SHOP_ITEM_PRICES } from '../../shared/economy';
import type {
    BuyItemResponse,
    DebugNotesResponse,
    DebugResetShopResponse,
    ErrorResponse,
    ListenTrackResponse,
    PianoEvent,
    PostInfoResponse,
    PublishTrackResponse,
    RemoveTrackResponse,
    SaveTrackResponse,
    SubmitRatingResponse,
    TrackModel,
    UserResponse,
    UserTracksResponse,
} from '../../shared/api';

export const api = new Hono();

const BASE_DURATION = 30;
const MAX_DURATION = 300;
const DEBUG_NOTES_STEP = 25;

const SHOP_INSTRUMENTS = [
    ShopItem.SYNTH_PIANO,
    ShopItem.ORGAN,
    ShopItem.RETRO,
    ShopItem.ELECTRO,
];

const isShopInstrument = (value: string): value is ShopItem => (
    SHOP_INSTRUMENTS.some((item) => item === value)
);

const isPianoEventType = (value: unknown): value is PianoEventType => (
    typeof value === 'string' && Object.values(PianoEventType).some((type) => type === value)
);

const isPianoEventValue = (value: unknown): value is string | number | boolean => (
    ['string', 'number', 'boolean'].includes(typeof value)
);

const parsePurchasedItems = (raw: string | undefined): ShopItem[] => {
    if (!raw) return [];

    return raw
        .split(',')
        .filter(isShopInstrument);
};

const averageRating = (totalRating: number, ratingCount: number) => (
    ratingCount > 0 ? Number((totalRating / ratingCount).toFixed(1)) : 0
);

const getTrackStats = async (trackId: string) => {
    const stats = await redis.hGetAll(`trackStats:${trackId}`);
    const totalRating = Number(stats?.totalRating ?? 0);
    const ratingCount = Number(stats?.ratingCount ?? 0);
    const listenerCount = Number(stats?.listenerCount ?? 0);

    return {
        averageRating: averageRating(totalRating, ratingCount),
        ratingCount,
        listenerCount,
        totalRating,
    };
};

const normalizeTimeline = (timeline: unknown): PianoEvent[] => {
    if (!Array.isArray(timeline)) return [];

    return timeline
        .map((event) => {
            if (!event || typeof event !== 'object') return null;

            const time = Reflect.get(event, 'time');
            const type = Reflect.get(event, 'type');
            const value = Reflect.get(event, 'value');
            if (typeof time !== 'number' || !isPianoEventType(type) || !isPianoEventValue(value)) return null;

            return {
                time,
                type,
                value,
            };
        })
        .filter((event) => event !== null);
};

const normalizeTrack = async (raw: string): Promise<TrackModel> => {
    const parsed = JSON.parse(raw);
    const id = String(parsed.id ?? '');
    const stats = await getTrackStats(id);
    const timeline = normalizeTimeline(parsed.timeline);
    const noteCount = Number(parsed.noteCount ?? timeline.filter((event) => event.type === PianoEventType.NoteOn).length);

    return {
        id,
        userId: String(parsed.userId ?? ''),
        name: String(parsed.name ?? 'Untitled Tune'),
        timeline,
        instrumentId: String(parsed.instrumentId ?? InstrumentId.DEFAULT_PIANO),
        createdAt: Number(parsed.createdAt ?? Date.now()),
        durationMs: Number(parsed.durationMs ?? 0),
        noteCount,
        isPublished: Boolean(parsed.isPublished),
        averageRating: stats.averageRating,
        ratingCount: stats.ratingCount,
        listenerCount: stats.listenerCount,
        postId: parsed.postId ? String(parsed.postId) : undefined,
        publishedAt: parsed.publishedAt ? Number(parsed.publishedAt) : undefined,
    };
};

const saveTrackModel = async (track: TrackModel) => {
    await redis.set(track.id, JSON.stringify(track));
};

/////////////////////////////////////////////
// GET USER
/////////////////////////////////////////////
api.get('/get-user', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'User not found' }, 400);

    const userData = await reddit.getCurrentUser();
    const userDetails = await redis.hGetAll(`userDetails:${userId}`);

    return c.json<UserResponse>({
        id: userId,
        name: userData?.username ?? 'Anonymous Whistler',
        notes: Number(userDetails?.notes ?? 0),
        purchasedItems: parsePurchasedItems(userDetails?.purchasedItems),
        maxTrackDuration: Number(userDetails?.maxTrackDuration ?? BASE_DURATION),
    });
});

/////////////////////////////////////////////
// POST INFO
/////////////////////////////////////////////
api.get('/post-info', async (c) => {
    const { userId, postId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);
    if (!postId) return c.json<PostInfoResponse>({ mode: AppMode.HUB });

    const riddleRaw = await redis.hGetAll(`riddle:${postId}`);
    if (!riddleRaw?.trackId) {
        return c.json<PostInfoResponse>({ mode: AppMode.HUB });
    }

    const trackRaw = await redis.get(riddleRaw.trackId);
    if (!trackRaw) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Track asset missing' }, 404);
    }

    const track = await normalizeTrack(trackRaw);
    const userVote = await redis.hGet(`trackVotes:${track.id}`, userId);
    const hasListened = Boolean(await redis.hGet(`trackListeners:${track.id}`, userId));
    const authorDetails = await redis.hGetAll(`userDetails:${track.userId}`);
    const authorNotes = Number(authorDetails?.notes ?? riddleRaw.authorNotes ?? 0);

    return c.json<PostInfoResponse>({
        mode: AppMode.RATE,
        riddleData: {
            track,
            averageRating: track.averageRating,
            ratingCount: track.ratingCount,
            listenerCount: track.listenerCount,
            hasListened,
            userVote: userVote ? Number(userVote) : null,
            isAuthor: track.userId === userId,
            authorName: riddleRaw.authorName ?? 'Unknown Maestro',
            authorNotes,
        },
    });
});

/////////////////////////////////////////////
// BUY ITEM
/////////////////////////////////////////////
api.post('/buy-item', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const body = await c.req.json<{ itemId?: string }>();
    const itemId = Object.values(ShopItem).find((candidate) => candidate === body.itemId);
    if (!itemId) return c.json<ErrorResponse>({ status: 'error', message: 'Unknown shop item' }, 400);

    const price = SHOP_ITEM_PRICES[itemId];
    const userDetails = await redis.hGetAll(`userDetails:${userId}`);
    const currentNotes = Number(userDetails?.notes ?? 0);

    if (currentNotes < price) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Not enough notes!' }, 400);
    }

    if (itemId === ShopItem.TIME_PLUS_5) {
        const currentDuration = Number(userDetails?.maxTrackDuration ?? BASE_DURATION);
        if (currentDuration >= MAX_DURATION) {
            return c.json<ErrorResponse>({ status: 'error', message: 'Max duration (5 min) already reached!' }, 400);
        }

        const newDuration = Math.min(currentDuration + 5, MAX_DURATION);

        await Promise.all([
            redis.hIncrBy(`userDetails:${userId}`, 'notes', -price),
            redis.hSet(`userDetails:${userId}`, { maxTrackDuration: String(newDuration) }),
        ]);

        return c.json<BuyItemResponse>({
            success: true,
            updatedNotes: currentNotes - price,
            updatedDuration: newDuration,
        });
    }

    const purchasedItems = parsePurchasedItems(userDetails?.purchasedItems);
    if (purchasedItems.includes(itemId)) {
        return c.json<ErrorResponse>({ status: 'error', message: 'You already own this instrument!' }, 400);
    }

    const updatedItems = [...purchasedItems, itemId];

    await Promise.all([
        redis.hIncrBy(`userDetails:${userId}`, 'notes', -price),
        redis.hSet(`userDetails:${userId}`, { purchasedItems: updatedItems.join(',') }),
    ]);

    return c.json<BuyItemResponse>({
        success: true,
        updatedNotes: currentNotes - price,
        purchasedItems: updatedItems,
    });
});

/////////////////////////////////////////////
// USER TRACKS
/////////////////////////////////////////////
api.get('/user-tracks', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const page = Math.max(Number.parseInt(c.req.query('page') || '1', 10), 1);
    const limit = Math.max(Number.parseInt(c.req.query('limit') || '4', 10), 1);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const trackIdsResult = await redis.zRange(`userTracks:${userId}`, startIndex, endIndex, { by: 'rank', reverse: true });
    const trackIds = trackIdsResult.map((item) => item.member);
    const pageIds = trackIds.slice(0, limit);
    const tracks: TrackModel[] = [];

    for (const id of pageIds) {
        const trackRaw = await redis.get(id);
        if (trackRaw) tracks.push(await normalizeTrack(trackRaw));
    }

    return c.json<UserTracksResponse>({
        tracks,
        page,
        limit,
        hasNextPage: trackIds.length > limit,
    });
});

/////////////////////////////////////////////
// SAVE TRACK
/////////////////////////////////////////////
api.post('/save-track', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const body = await c.req.json<{
        name?: string;
        timeline?: PianoEvent[];
        instrumentId?: string;
        durationMs?: number;
        noteCount?: number;
    }>();

    const now = Date.now();
    const trackId = `track:${userId}:${now}`;
    const timeline = normalizeTimeline(body.timeline);
    const noteCount = Number(body.noteCount ?? timeline.filter((event) => event.type === PianoEventType.NoteOn).length);

    const newTrack: TrackModel = {
        id: trackId,
        userId,
        name: body.name?.trim() || 'Untitled Tune',
        timeline,
        instrumentId: body.instrumentId || InstrumentId.DEFAULT_PIANO,
        createdAt: now,
        durationMs: Number(body.durationMs ?? 0),
        noteCount,
        isPublished: false,
        averageRating: 0,
        ratingCount: 0,
        listenerCount: 0,
    };

    await Promise.all([
        saveTrackModel(newTrack),
        redis.zAdd(`userTracks:${userId}`, { member: trackId, score: now }),
        redis.hSet(`trackStats:${trackId}`, {
            totalRating: '0',
            ratingCount: '0',
            listenerCount: '0',
        }),
    ]);

    return c.json<SaveTrackResponse>(newTrack);
});

/////////////////////////////////////////////
// DELETE TRACK
/////////////////////////////////////////////
api.post('/delete-track', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const body = await c.req.json<{ trackId?: string }>();
    if (!body.trackId) return c.json<ErrorResponse>({ status: 'error', message: 'Track id missing' }, 400);

    const trackRaw = await redis.get(body.trackId);
    if (!trackRaw) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Track not found' }, 404);
    }

    const track = await normalizeTrack(trackRaw);
    if (track.userId !== userId) {
        return c.json<ErrorResponse>({ status: 'error', message: 'You can only delete your own tracks' }, 403);
    }

    if (track.isPublished) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Cannot delete a published track' }, 400);
    }

    await Promise.all([
        redis.del(track.id),
        redis.del(`trackStats:${track.id}`),
        redis.zRem(`userTracks:${userId}`, [track.id]),
    ]);

    return c.json<RemoveTrackResponse>({ success: true });
});

/////////////////////////////////////////////
// PUBLISH TRACK
/////////////////////////////////////////////
api.post('/publish-track', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const body = await c.req.json<{ trackId?: string }>();
    if (!body.trackId) return c.json<ErrorResponse>({ status: 'error', message: 'Track id missing' }, 400);

    const trackRaw = await redis.get(body.trackId);
    if (!trackRaw) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Track not found' }, 404);
    }

    const track = await normalizeTrack(trackRaw);
    if (track.userId !== userId) {
        return c.json<ErrorResponse>({ status: 'error', message: 'You can only publish your own tracks' }, 403);
    }

    if (track.isPublished) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Track already published' }, 400);
    }

    const userData = await reddit.getCurrentUser();
    const userDetails = await redis.hGetAll(`userDetails:${userId}`);
    const currentNotes = Number(userDetails?.notes ?? 0);
    const post = await createPost(`ToonTune: ${track.name}`);
    const updatedTrack: TrackModel = {
        ...track,
        isPublished: true,
        postId: post.id,
        publishedAt: Date.now(),
    };

    await Promise.all([
        saveTrackModel(updatedTrack),
        redis.hSet(`riddle:${post.id}`, {
            trackId: updatedTrack.id,
            authorName: userData?.username ?? 'Anonymous',
            authorNotes: String(currentNotes + PUBLISH_REWARD),
        }),
        redis.hIncrBy(`userDetails:${userId}`, 'notes', PUBLISH_REWARD),
    ]);

    return c.json<PublishTrackResponse>({ bonusNotes: PUBLISH_REWARD, postId: post.id });
});

/////////////////////////////////////////////
// LISTEN TRACK
/////////////////////////////////////////////
api.post('/listen-track', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const body = await c.req.json<{ trackId?: string }>();
    if (!body.trackId) return c.json<ErrorResponse>({ status: 'error', message: 'Track id missing' }, 400);

    const alreadyListened = await redis.hGet(`trackListeners:${body.trackId}`, userId);
    if (!alreadyListened) {
        await Promise.all([
            redis.hSet(`trackListeners:${body.trackId}`, { [userId]: '1' }),
            redis.hIncrBy(`trackStats:${body.trackId}`, 'listenerCount', 1),
        ]);
    }

    const stats = await getTrackStats(body.trackId);

    return c.json<ListenTrackResponse>({
        hasListened: true,
        listenerCount: stats.listenerCount,
    });
});

/////////////////////////////////////////////
// RATE TRACK
/////////////////////////////////////////////
api.post('/rate-track', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const body = await c.req.json<{ trackId?: string; rating?: number }>();
    if (!body.trackId) return c.json<ErrorResponse>({ status: 'error', message: 'Track id missing' }, 400);

    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Rating must be between 1 and 10' }, 400);
    }

    const hasListened = await redis.hGet(`trackListeners:${body.trackId}`, userId);
    if (!hasListened) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Listen first, Maestro!' }, 400);
    }

    const alreadyVoted = await redis.hGet(`trackVotes:${body.trackId}`, userId);
    if (alreadyVoted) {
        return c.json<ErrorResponse>({ status: 'error', message: 'You already rated this record, pal!' }, 400);
    }

    await Promise.all([
        redis.hSet(`trackVotes:${body.trackId}`, { [userId]: String(rating) }),
        redis.hIncrBy(`trackStats:${body.trackId}`, 'totalRating', rating),
        redis.hIncrBy(`trackStats:${body.trackId}`, 'ratingCount', 1),
        redis.hIncrBy(`userDetails:${userId}`, 'notes', RATING_REWARD),
    ]);

    const stats = await getTrackStats(body.trackId);

    return c.json<SubmitRatingResponse>({
        rating,
        reward: RATING_REWARD,
        averageRating: stats.averageRating,
        ratingCount: stats.ratingCount,
    });
});

/////////////////////////////////////////////
// DEBUG SHOP HELPERS
/////////////////////////////////////////////
api.post('/debug/add-notes', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const notes = await redis.hIncrBy(`userDetails:${userId}`, 'notes', DEBUG_NOTES_STEP);

    return c.json<DebugNotesResponse>({ notes });
});

api.post('/debug/remove-notes', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const userDetails = await redis.hGetAll(`userDetails:${userId}`);
    const currentNotes = Number(userDetails?.notes ?? 0);
    const nextNotes = Math.max(currentNotes - DEBUG_NOTES_STEP, 0);
    await redis.hSet(`userDetails:${userId}`, { notes: String(nextNotes) });

    return c.json<DebugNotesResponse>({ notes: nextNotes });
});

api.post('/debug/reset-shop', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const userDetails = await redis.hGetAll(`userDetails:${userId}`);
    const notes = Number(userDetails?.notes ?? 0);
    await redis.hSet(`userDetails:${userId}`, {
        purchasedItems: '',
        maxTrackDuration: String(BASE_DURATION),
    });

    return c.json<DebugResetShopResponse>({
        notes,
        purchasedItems: [],
        maxTrackDuration: BASE_DURATION,
    });
});
