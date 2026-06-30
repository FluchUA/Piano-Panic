/////////////////////////////////////////////
// ENUMS
/////////////////////////////////////////////

export enum AppMode {
    HUB = 'HUB',
    RATE = 'RATE',
}

export enum ShopItem {
    TIME_PLUS_5 = 'time_plus_5',
    SYNTH_PIANO = 'synth_piano',
    ORGAN = 'organ',
    RETRO = 'retro',
    ELECTRO = 'electro',
}

export enum InstrumentId {
    DEFAULT_PIANO = 'SamplerPiano',
    SYNTH_PIANO = 'Synth',
    ORGAN = 'SamplerOrgan',
    RETRO = 'MonoSynth',
    ELECTRO = 'FMSynth',
}

export enum PianoEventType {
    NoteOn = 'NOTE_ON',
    NoteOff = 'NOTE_OFF',
    OctaveSet = 'OCTAVE_SET',
    PedalToggle = 'PEDAL_TOGGLE',
    MetronomeToggle = 'METRONOME_TOGGLE',
}

/////////////////////////////////////////////
// BASE MODELS
/////////////////////////////////////////////

export type ErrorResponse = {
    status: 'error';
    message: string;
};

export type PianoEvent = {
    time: number; // Milliseconds from the start of the recording
    type: PianoEventType;
    value: string | number | boolean; // Note, octave offset, pedal state, or metronome state
};

export type TrackModel = {
    id: string;
    userId: string;
    name: string;
    timeline: PianoEvent[];
    instrumentId: string;
    createdAt: number;
    durationMs: number;
    noteCount: number;
    isPublished: boolean;
    averageRating: number;
    ratingCount: number;
    listenerCount: number;
    postId?: string;
    publishedAt?: number;
};

/////////////////////////////////////////////
// API RESPONSES
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
            listenerCount: number;
            hasListened: boolean;
            userVote: number | null;
            isAuthor: boolean;
            authorName: string;
            authorNotes: number;
        };
    };

export type BuyItemResponse = {
    success: true;
    updatedNotes: number;
    updatedDuration?: number;
    purchasedItems?: ShopItem[];
};

export type UserTracksResponse = {
    tracks: TrackModel[];
    page: number;
    limit: number;
    hasNextPage: boolean;
};

export type SaveTrackResponse = TrackModel;

export type PublishTrackResponse = {
    bonusNotes: number;
    postId: string;
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

export type ListenTrackResponse = {
    hasListened: true;
    listenerCount: number;
};

export type DebugNotesResponse = {
    notes: number;
};

export type DebugResetShopResponse = {
    notes: number;
    purchasedItems: ShopItem[];
    maxTrackDuration: number;
};
