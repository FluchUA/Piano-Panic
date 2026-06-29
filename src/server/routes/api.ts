import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import { ShopItem, AppMode } from '../../shared/api';
import type {
    ErrorResponse,
    UserResponse,
    PostInfoResponse,
    BuyItemResponse,
    UserTracksResponse,
    SaveTrackResponse,
    PublishTrackResponse,
    SubmitRatingResponse,
    RemoveTrackResponse,
} from '../../shared/api';

export const api = new Hono();

const BASE_DURATION = 30; 
const MAX_DURATION = 300; // MAX 5 min
const RATING_REWARD = 5;
const PUBLISH_REWARD = 20;

const ITEM_PRICES = {
    [ShopItem.ORGAN]: 150,
    [ShopItem.PIANO]: 300,
    [ShopItem.TIME_PLUS_5]: 50
};

/////////////////////////////////////////////
// GET USER
/////////////////////////////////////////////
api.get('/get-user', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'User not found' }, 400);

    const userData = await reddit.getCurrentUser();

    const userDetails = await redis.hGetAll(`userDetails:${userId}`);

    const purchasedItemsRaw = userDetails?.purchasedItems ?? '';
    const purchasedItems = purchasedItemsRaw 
        ? (purchasedItemsRaw.split(',') as ShopItem[]) 
        : [];

    const maxTrackDuration = Number(userDetails?.maxTrackDuration ?? BASE_DURATION);

    return c.json<UserResponse>({
        id: userId,
        name: userData?.username ?? 'Anonymous Whistler',
        notes: Number(userDetails?.notes ?? 0),
        purchasedItems,
        maxTrackDuration,
    });
});

/////////////////////////////////////////////
// POST INFO
/////////////////////////////////////////////
api.get('/post-info', async (c) => {
    const { userId, postId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);
    if (!postId) return c.json<PostInfoResponse>({ mode: AppMode.HUB }); 

    // If the post has been opened but there is no riddle there
    const riddleRaw = await redis.hGetAll(`riddle:${postId}`);
    if (!riddleRaw || !riddleRaw.trackId) {
        return c.json<PostInfoResponse>({ mode: AppMode.HUB });
    }

    // Get the track by ID
    const trackRaw = await redis.get(`track:${riddleRaw.trackId}`);    
    if (!trackRaw) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Track asset missing' }, 404);
    }

    // Check whether the user has already voted (check for the presence of a field in the post's response hash)
    const track = JSON.parse(trackRaw);
    const userVote = await redis.hGet(`riddleVotes:${postId}`, userId) ?? null;

    // Calculate the average rating based on total score and total votes count
    const totalRating = Number(riddleRaw.totalRating ?? 0);
    const ratingCount = Number(riddleRaw.ratingCount ?? 0);
    const averageRating = ratingCount > 0 ? Number((totalRating / ratingCount).toFixed(1)) : 0;

    return c.json<PostInfoResponse>({
        mode: AppMode.RATE,
        riddleData: {
            track,
            averageRating,
            ratingCount,
            userVote: userVote ? Number(userVote) : null,
            authorName: riddleRaw.authorName ?? 'Unknown Maestro',
            authorNotes: Number(riddleRaw.authorNotes ?? 0)
        }
    });
});

/////////////////////////////////////////////
// BUY ITEM
/////////////////////////////////////////////
api.post('/buy-item', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const { itemId } = await c.req.json();
    const price = ITEM_PRICES[itemId as ShopItem] || 99999;

    const userDetails = await redis.hGetAll(`userDetails:${userId}`);
    const currentNotes = Number(userDetails?.notes ?? 0);

    if (currentNotes < price) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Not enough notes!' }, 400);
    }

    // Logic for bulk time purchases
    if (itemId === ShopItem.TIME_PLUS_5) {
        const currentDuration = Number(userDetails?.maxTrackDuration ?? BASE_DURATION);
        
        if (currentDuration >= MAX_DURATION) {
            return c.json<ErrorResponse>({ status: 'error', message: 'Max duration (5 min) already reached!' }, 400);
        }

        const newDuration = currentDuration + 5;

        await Promise.all([
            redis.hIncrBy(`userDetails:${userId}`, 'notes', -price),
            redis.hSet(`userDetails:${userId}`, { maxTrackDuration: String(newDuration) })
        ]);

        return c.json<BuyItemResponse>({ 
            success: true, 
            updatedNotes: currentNotes - price,
            updatedDuration: newDuration 
        });
    }

    // Logic for unique instruments (organ, piano)
    const purchasedItemsRaw = userDetails?.purchasedItems ?? '';
    const purchasedItems = purchasedItemsRaw ? purchasedItemsRaw.split(',') : [];

    if (purchasedItems.includes(itemId)) {
        return c.json<ErrorResponse>({ status: 'error', message: 'You already own this instrument!' }, 400);
    }

    purchasedItems.push(itemId);

    await Promise.all([
        redis.hIncrBy(`userDetails:${userId}`, 'notes', -price),
        redis.hSet(`userDetails:${userId}`, { purchasedItems: purchasedItems.join(',') })
    ]);

    return c.json<BuyItemResponse>({ 
        success: true, 
        updatedNotes: currentNotes - price,
        purchasedItems: purchasedItems as ShopItem[]
    });
});

/////////////////////////////////////////////
// USER TRACKS
/////////////////////////////////////////////
api.get('/user-tracks', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '4');

    // Get a list of track IDs from a Sorted Set (from newest to oldest)
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit - 1;
    
    // Use zRange with the REV option so that the new tracks play first
    const trackIdsResult = await redis.zRange(`userTracks:${userId}`, startIndex, endIndex, { by: 'rank', reverse: true });
    const pageIds = trackIdsResult.map(item => item.member);

    const tracks = [];
    for (const id of pageIds) {
        const t = await redis.get(id);
        if (t) tracks.push(JSON.parse(t));
    }

    return c.json<UserTracksResponse>(tracks);
});

/////////////////////////////////////////////
// SAVE TRACK
/////////////////////////////////////////////
api.post('/save-track', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const { name, timeline, instrumentId } = await c.req.json();
    const trackId = `track:${userId}:${Date.now()}`;

    const newTrack = { id: trackId, userId, name, timeline, instrumentId, isPublished: false };
    await redis.set(trackId, JSON.stringify(newTrack));

    // Add the track ID to the list of user-created tracks
    await redis.zAdd(`userTracks:${userId}`, { member: trackId, score: Date.now() });

    return c.json<SaveTrackResponse>(newTrack);
});

/////////////////////////////////////////////
// DELETE TRACK
/////////////////////////////////////////////
api.post('/delete-track', async (c) => {
    const { userId } = context;
    if (!userId) return c.json<ErrorResponse>({ status: 'error', message: 'Unauthorized' }, 401);

    const { trackId } = await c.req.json();
    const trackRaw = await redis.get(trackId);
    
    if (!trackRaw) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Track not found' }, 404);
    }

    const track = JSON.parse(trackRaw);
    
    if (track.isPublished) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Cannot delete a published track' }, 400);
    }

    await Promise.all([
        redis.del(trackId),
        redis.zRem(`userTracks:${userId}`, trackId)
    ]);

    return c.json<RemoveTrackResponse>({ success: true });
});

/////////////////////////////////////////////
// PUBLISH TRACK
/////////////////////////////////////////////
api.post('/publish-track', async (c) => {
    const { userId, postId } = context;
    if (!userId || !postId) return c.json<ErrorResponse>({ status: 'error', message: 'Context missing' }, 400);

    const { trackId } = await c.req.json();
    const userData = await reddit.getCurrentUser();
    const userDetails = await redis.hGetAll(`userDetails:${userId}`);
    const currentNotes = Number(userDetails?.notes ?? 0);

    // Update the status of the track
    const trackRaw = await redis.get(trackId);
    if (trackRaw) {
        const track = JSON.parse(trackRaw);
        track.isPublished = true;
        await redis.set(trackId, JSON.stringify(track));
    }

    // Put the riddle in a post hash
    await redis.hSet(`riddle:${postId}`, {
        trackId: trackId,
        totalRating: '0',
        ratingCount: '0',
        authorName: userData?.username ?? 'Anonymous',
        authorNotes: String(currentNotes + PUBLISH_REWARD) 
    });

    // Add notes to the author's profile
    await redis.hIncrBy(`userDetails:${userId}`, 'notes', PUBLISH_REWARD);

    return c.json<PublishTrackResponse>({ bonusNotes: PUBLISH_REWARD });
});

/////////////////////////////////////////////
// RATE TRACK
/////////////////////////////////////////////
api.post('/rate-track', async (c) => {
    const { userId, postId } = context;
    if (!userId || !postId) return c.json<ErrorResponse>({ status: 'error', message: 'Context missing' }, 400);

    const { rating } = await c.req.json(); 
    if (rating < 0 || rating > 10) {
        return c.json<ErrorResponse>({ status: 'error', message: 'Rating must be between 0 and 10' }, 400);
    }

    // Check if the user has replied before
    const alreadyVoted = await redis.hGet(`riddleVotes:${postId}`, userId);
    if (alreadyVoted) {
        return c.json<ErrorResponse>({ status: 'error', message: 'You already played this record, pal!' }, 400);
    }

    const riddle = await redis.hGetAll(`riddle:${postId}`);
    if (!riddle) return c.json<ErrorResponse>({ status: 'error', message: 'Riddle not found' }, 404);

    // Save the user's selection and increment the vote count for that option
    await Promise.all([
        redis.hSet(`riddleVotes:${postId}`, { [userId]: String(rating) }),
        redis.hIncrBy(`riddle:${postId}`, 'totalRating', rating),
        redis.hIncrBy(`riddle:${postId}`, 'ratingCount', 1),
        redis.hIncrBy(`userDetails:${userId}`, 'notes', RATING_REWARD)
    ]);

    const updatedRiddle = await redis.hGetAll(`riddle:${postId}`);

    // Retrieve the updated vote data to synchronize the interface
    const totalRating = Number(updatedRiddle?.totalRating ?? 0);
    const ratingCount = Number(updatedRiddle?.ratingCount ?? 0);
    const averageRating = ratingCount > 0 ? Number((totalRating / ratingCount).toFixed(1)) : 0;

    return c.json<SubmitRatingResponse>({
        rating,
        reward: RATING_REWARD,
        averageRating,
        ratingCount
    });
});