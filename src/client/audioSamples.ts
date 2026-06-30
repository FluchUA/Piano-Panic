import { InstrumentId } from '../shared/api';

export type SampledInstrumentId = InstrumentId.DEFAULT_PIANO | InstrumentId.ORGAN;

export type AudioSampleAsset = {
    key: string;
    instrument: SampledInstrumentId;
    note: string;
    path: string;
};

const SAMPLE_NOTE_FILES: Record<string, string> = {
    C3: 'C3.mp3',
    'D#3': 'Ds3.mp3',
    'F#3': 'Fs3.mp3',
    A3: 'A3.mp3',
    C4: 'C4.mp3',
    'D#4': 'Ds4.mp3',
    'F#4': 'Fs4.mp3',
    A4: 'A4.mp3',
    C5: 'C5.mp3',
    'D#5': 'Ds5.mp3',
    'F#5': 'Fs5.mp3',
    A5: 'A5.mp3',
    C6: 'C6.mp3',
};

const ORGAN_EXTRA_SAMPLE_NOTE_FILES: Record<string, string> = {
    'F#1': 'Fs1.mp3',
    'F#2': 'Fs2.mp3',
};

const SAMPLE_FOLDERS: Record<SampledInstrumentId, string> = {
    [InstrumentId.DEFAULT_PIANO]: 'piano',
    [InstrumentId.ORGAN]: 'organ',
};

const SAMPLED_INSTRUMENTS: SampledInstrumentId[] = [
    InstrumentId.DEFAULT_PIANO,
    InstrumentId.ORGAN,
];

export const getSampleAudioKey = (instrument: SampledInstrumentId, note: string) => (
    `sample_${SAMPLE_FOLDERS[instrument]}_${note.replace('#', 's')}`
);

export const AUDIO_SAMPLE_ASSETS: AudioSampleAsset[] = SAMPLED_INSTRUMENTS.flatMap((instrument) => (
    Object.entries({
        ...SAMPLE_NOTE_FILES,
        ...(instrument === InstrumentId.ORGAN ? ORGAN_EXTRA_SAMPLE_NOTE_FILES : {}),
    }).map(([note, fileName]) => ({
        key: getSampleAudioKey(instrument, note),
        instrument,
        note,
        path: `audio/${SAMPLE_FOLDERS[instrument]}/${fileName}`,
    }))
));

export const isSampledInstrument = (instrument: InstrumentId): instrument is SampledInstrumentId => (
    instrument === InstrumentId.DEFAULT_PIANO || instrument === InstrumentId.ORGAN
);
