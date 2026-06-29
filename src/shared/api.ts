/////////////////////////////////////////////
// ENUMS
/////////////////////////////////////////////

export enum AppMode {
    HUB = 'HUB',
    RATE = 'RATE',
}

export enum ShopItem {
    ORGAN = 'organ',
    PIANO = 'piano',
    TIME_PLUS_5 = 'time_plus_5',
}

export enum PianoEventType {
    NoteOn = 'NOTE_ON',
    NoteOff = 'NOTE_OFF',
    OctaveSet = 'OCTAVE_SET',
    PedalToggle = 'PEDAL_TOGGLE',
}

/////////////////////////////////////////////
// BASE MODELS
/////////////////////////////////////////////

export type ErrorResponse = {
    status: 'error';
    message: string;
};

export interface TrackModel {
    id: string;
    userId: string;
    name: string;
    timeline: PianoEvent[];
    instrumentId: string;
    isPublished: boolean;
}

export interface PianoEvent {
    time: number;                    // Milliseconds from the start of the recording
    type: PianoEventType;
    value: string | number | boolean; // Note (‘C4’), octave (1), or pedal (true)
}

/////////////////////////////////////////////
// APIs ANSWERS
/////////////////////////////////////////////

export type UserResponse = {
id: string;
    name: string;
    notes: number;
    purchasedItems: ShopItem[];
    maxTrackDuration: number;
};

export type PostInfoResponse = 
    | { mode: AppMode.HUB }
    | { 
        mode: AppMode.RATE; 
        riddleData: {
            track: TrackModel;
            averageRating: number;
            ratingCount: number;
            userVote: number | null;
            authorName: string;
            authorNotes: number;
        }
      };

export type BuyItemResponse = {
    success: true;
    updatedNotes: number;
    updatedDuration?: number; // Only available when purchasing time
    purchasedItems?: ShopItem[]; // Only available when purchasing items
};

export type UserTracksResponse = TrackModel[];

export type SaveTrackResponse = TrackModel;

export type PublishTrackResponse = {
    bonusNotes: number;
};

export type RemoveTrackResponse = {
    success: boolean;
};

export type SubmitRatingResponse = {
    rating: number;
    reward: number;
    averageRating: number;
    ratingCount: number;
};