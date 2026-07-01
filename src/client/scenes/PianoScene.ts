import Phaser, { Scene } from 'phaser';
import * as Tone from 'tone';
import { ConfirmDialog } from '../UI/ConfirmDialog';
import { InfoDialog } from '../UI/InfoDialog';
import { SaveTrackDialog } from '../UI/SaveTrackDialog';
import { ToonButton } from '../UI/ToonButton';
import { RedditAPI } from '../utils/RedditAPI';
import { InstrumentId, PianoEventType, ShopItem } from '../../shared/api';
import { PUBLISH_REWARD } from '../../shared/economy';
import type { PianoEvent, TrackModel, UserResponse } from '../../shared/api';
import {
    AUDIO_SAMPLE_ASSETS,
    getSampleAudioKey,
    isSampledInstrument,
    type SampledInstrumentId,
} from '../audioSamples';

type PianoMode = 'compose' | 'playback';

type PianoSceneData = {
    mode?: PianoMode;
    track?: TrackModel;
    returnScene?: string;
};

type PlayableInstrument = {
    triggerAttack: (note: string) => void;
    triggerRelease: (note: string, time?: string) => void;
    dispose: () => void;
};

type InstrumentOption = {
    id: InstrumentId;
    name: string;
};

type HoldControl = {
    container: Phaser.GameObjects.Container;
    background: Phaser.GameObjects.Rectangle;
};

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTES = [
    { note: 'C#', afterWhiteIndex: 0 },
    { note: 'D#', afterWhiteIndex: 1 },
    { note: 'F#', afterWhiteIndex: 3 },
    { note: 'G#', afterWhiteIndex: 4 },
    { note: 'A#', afterWhiteIndex: 5 },
];

const KEYBOARD_MAP: Record<string, string> = {
    Z: 'C',
    S: 'C#',
    X: 'D',
    D: 'D#',
    C: 'E',
    V: 'F',
    G: 'F#',
    B: 'G',
    H: 'G#',
    N: 'A',
    J: 'A#',
    M: 'B',
};

const SHOP_INSTRUMENTS: Record<ShopItem, InstrumentOption | null> = {
    [ShopItem.TIME_PLUS_5]: null,
    [ShopItem.SYNTH_PIANO]: { id: InstrumentId.SYNTH_PIANO, name: 'PIANO SYNTH' },
    [ShopItem.ORGAN]: { id: InstrumentId.ORGAN, name: 'ORGAN' },
    [ShopItem.RETRO]: { id: InstrumentId.RETRO, name: 'RETRO' },
    [ShopItem.ELECTRO]: { id: InstrumentId.ELECTRO, name: 'ELECTRO' },
};

const NOTE_RELEASE_SECONDS = 0.42;
const PLAYBACK_RELEASE_TAIL_MS = 700;
const METRONOME_INTERVAL_MS = 500;

export class PianoScene extends Scene {
    private mode: PianoMode = 'compose';
    private returnScene = 'MainMenu';
    private track: TrackModel | undefined;
    private user: UserResponse | undefined;

    private synth!: PlayableInstrument;
    private instrumentReady: Promise<void> = Promise.resolve();
    private currentInstrument: InstrumentId = InstrumentId.DEFAULT_PIANO;
    private activeNotes: Record<string, string> = {};
    private sustainedNotes = new Set<string>();
    private triggeredInputs = new Set<string>();
    private keyVisuals = new Map<string, Phaser.GameObjects.Rectangle>();
    private heldSidePedals = new Set<string>();
    private octaveHolds = new Map<string, number>();

    private background!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private timeText!: Phaser.GameObjects.Text;
    private pianoGroup!: Phaser.GameObjects.Container;
    private instrumentGroup!: Phaser.GameObjects.Container;
    private dialog!: InfoDialog;
    private confirmDialog!: ConfirmDialog;
    private saveDialog!: SaveTrackDialog;

    private backButton!: ToonButton;
    private infoButton!: ToonButton;
    private recordButton?: ToonButton;
    private saveButton?: ToonButton;
    private bottomPedalButton?: ToonButton;
    private metronomeButton?: ToonButton;
    private playButton?: ToonButton;
    private restartButton?: ToonButton;
    private publishButton?: ToonButton;
    private deleteTrackButton?: ToonButton;

    private isRecording = false;
    private recordingStopped = false;
    private recordStartedAt: number | null = null;
    private recordingElapsedMs = 0;
    private timeline: PianoEvent[] = [];
    private noteCount = 0;
    private lastRecordSignature = '';
    private lastRecordTime = -1;
    private readonly maxTimelineEvents = 5000;

    private bottomPedalEnabled = false;
    private currentOctaveOffset = 0;
    private metronomeEnabled = false;
    private metronomeTimer?: Phaser.Time.TimerEvent;
    private metronomeBeat = 0;
    private metronomeClickSynth?: Tone.Synth;
    private timeTimer?: Phaser.Time.TimerEvent;

    private playbackOffsetMs = 0;
    private playbackStartedAt = 0;
    private playbackPedalActive = false;
    private isPlaying = false;
    private playbackTimers: Phaser.Time.TimerEvent[] = [];
    private resizeHandler = () => this.refreshLayout();

    constructor() {
        super('PianoScene');
    }

    init(data?: PianoSceneData) {
        this.mode = data?.mode ?? (data?.track ? 'playback' : 'compose');
        this.track = data?.track;
        this.returnScene = data?.returnScene ?? (this.mode === 'playback' ? 'UserRecordsScene' : 'MainMenu');
    }

    create() {
        this.user = this.registry.get('user');
        this.currentInstrument = this.getInitialInstrument();
        this.changeInstrument(this.currentInstrument);
        this.input.addPointer(5);

        this.background = this.add.image(0, 0, 'background').setOrigin(0);
        this.pianoGroup = this.add.container(0, 0);
        this.instrumentGroup = this.add.container(0, 0);
        this.dialog = new InfoDialog({ scene: this });
        this.confirmDialog = new ConfirmDialog({ scene: this });
        this.saveDialog = new SaveTrackDialog({ scene: this });

        this.title = this.add.text(0, 0, this.mode === 'compose' ? 'COMPOSE A TUNE' : 'LISTENING BOOTH', {
            fontSize: '38px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#2f2118',
            strokeThickness: 7,
            align: 'center',
        }).setOrigin(0.5);

        this.timeText = this.add.text(0, 0, '', {
            fontSize: '24px',
            color: '#fff4c2',
            fontStyle: 'bold',
            stroke: '#2f2118',
            strokeThickness: 5,
        }).setOrigin(0.5);

        this.createTopControls();
        this.createModeControls();
        this.createTrackActionButtons();
        this.setupKeyboardInput();
        this.refreshLayout();
        this.updateStatus();
        this.updateTrackActionButtons();

        this.scale.on('resize', this.resizeHandler);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownScene());

        if (this.mode === 'playback') {
            this.time.delayedCall(250, () => {
                void this.startPlayback();
            });
        }
    }

    private createTopControls() {
        this.backButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 52,
            height: 42,
            label: '<',
            fontSize: 22,
            onClick: () => this.handleBack(),
        });

        this.infoButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 46,
            height: 42,
            label: 'i',
            fontSize: 20,
            onClick: () => this.openInfo(),
        });
    }

    private createModeControls() {
        if (this.mode === 'compose') {
            this.recordButton = new ToonButton({
                scene: this,
                x: 0,
                y: 0,
                width: 54,
                height: 44,
                label: 'REC',
                fontSize: 13,
                onClick: () => this.handleRecordButton(),
            });

            this.saveButton = new ToonButton({
                scene: this,
                x: 0,
                y: 0,
                width: 48,
                height: 44,
                label: 'S',
                fontSize: 18,
                onClick: () => this.saveTrack(),
            });

            this.createInstrumentButtons();
            return;
        }

        this.playButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 54,
            height: 44,
            label: '||',
            fontSize: 18,
            onClick: () => this.togglePlayback(),
        });

        this.restartButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 54,
            height: 44,
            label: 'R',
            fontSize: 18,
            onClick: () => this.restartPlayback(),
        });
    }

    private createTrackActionButtons() {
        this.publishButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 48,
            height: 42,
            label: '^',
            fontSize: 18,
            onClick: () => this.confirmPublishTrack(),
        });

        this.deleteTrackButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 48,
            height: 42,
            label: 'X',
            fontSize: 17,
            onClick: () => this.confirmDeleteTrack(),
        });
    }

    private createInstrumentButtons() {
        this.instrumentGroup.removeAll(true);

        this.getAvailableInstruments().forEach((instrument) => {
            const button = new ToonButton({
                scene: this,
                x: 0,
                y: 0,
                width: 42,
                height: 38,
                label: this.getInstrumentLabel(instrument),
                fontSize: 14,
                onClick: () => {
                    this.changeInstrument(instrument.id);
                    this.createInstrumentButtons();
                    this.refreshLayout();
                },
            });
            button.setDisabled(this.currentInstrument === instrument.id);
            this.instrumentGroup.add(button);
        });
    }

    private refreshLayout() {
        const { width, height } = this.scale;
        const titleY = Math.max(48, height * 0.075);
        const titleWidth = Math.max(150, Math.min(260, width - 150));

        this.cameras.resize(width, height);
        this.background.setDisplaySize(width, height);
        this.title.setPosition(width / 2, titleY);
        this.title.setFontSize(Math.max(26, Math.min(38, width * 0.046)));
        this.title.setWordWrapWidth(titleWidth);
        this.backButton.setPosition(38, 42);
        this.infoButton.setPosition(width - 38, 42);

        if (this.mode === 'compose') {
            this.timeText.setPosition(width / 2, titleY + 122);
            this.recordButton?.setPosition(38, 92);
            this.saveButton?.setPosition(width - 38, 92);
            this.layoutInstrumentButtons(width, titleY + 62);
        } else {
            this.playButton?.setPosition(width / 2 - 34, titleY + 62);
            this.restartButton?.setPosition(width / 2 + 34, titleY + 62);
        }

        this.publishButton?.setPosition(width - 94, 92);
        this.deleteTrackButton?.setPosition(width - 150, 92);

        this.drawPianoRig(width, height);
        this.updateTrackActionButtons();
    }

    private layoutInstrumentButtons(width: number, y: number) {
        const buttons = this.instrumentGroup.list.filter((child) => child instanceof ToonButton);
        const gap = 8;
        const maxButtonsPerRow = Math.max(3, Math.min(5, Math.floor(width / 54)));
        const rowWidth = Math.min(buttons.length, maxButtonsPerRow) * 50 - gap;
        const startX = width / 2 - rowWidth / 2 + 21;

        buttons.forEach((button, index) => {
            const row = Math.floor(index / maxButtonsPerRow);
            const col = index % maxButtonsPerRow;
            button.setPosition(startX + col * 50, y + row * 42);
        });
    }

    private drawPianoRig(width: number, height: number) {
        this.pianoGroup.removeAll(true);
        this.keyVisuals.clear();

        const sideWidth = Math.max(54, Math.min(76, width * 0.08));
        const availablePianoWidth = width - sideWidth * 2 - 32;
        const whiteKeyWidth = Math.min(74, availablePianoWidth / WHITE_NOTES.length);
        const whiteKeyHeight = Math.max(150, Math.min(height * 0.38, 260));
        const pianoWidth = whiteKeyWidth * WHITE_NOTES.length;
        const startX = width / 2 - pianoWidth / 2;
        const startY = height - whiteKeyHeight - 70;

        this.createSideControls(startX - sideWidth / 2 - 12, startY + whiteKeyHeight / 2);
        this.createSideControls(startX + pianoWidth + sideWidth / 2 + 12, startY + whiteKeyHeight / 2);

        WHITE_NOTES.forEach((note, index) => {
            const key = this.add.rectangle(
                startX + index * whiteKeyWidth,
                startY,
                whiteKeyWidth - 2,
                whiteKeyHeight,
                0xffffff
            ).setOrigin(0).setStrokeStyle(2, 0x2f2118);

            if (this.mode === 'compose') {
                key.setInteractive({ useHandCursor: true });
                key.on('pointerdown', () => {
                    void this.playNote(note, `pointer:${note}`);
                });
                key.on('pointerup', () => this.stopNote(`pointer:${note}`));
                key.on('pointerout', () => this.stopNote(`pointer:${note}`));
            }

            this.keyVisuals.set(note, key);
            this.pianoGroup.add(key);
        });

        BLACK_NOTES.forEach(({ note, afterWhiteIndex }) => {
            const blackWidth = whiteKeyWidth * 0.62;
            const blackHeight = whiteKeyHeight * 0.58;
            const x = startX + (afterWhiteIndex + 1) * whiteKeyWidth - blackWidth / 2;
            const key = this.add.rectangle(x, startY, blackWidth, blackHeight, 0x17110d)
                .setOrigin(0)
                .setStrokeStyle(2, 0xf8d66d);

            if (this.mode === 'compose') {
                key.setInteractive({ useHandCursor: true });
                key.on('pointerdown', () => {
                    void this.playNote(note, `pointer:${note}`);
                });
                key.on('pointerup', () => this.stopNote(`pointer:${note}`));
                key.on('pointerout', () => this.stopNote(`pointer:${note}`));
            }

            this.keyVisuals.set(note, key);
            this.pianoGroup.add(key);
        });

        this.metronomeButton = new ToonButton({
            scene: this,
            x: width / 2,
            y: startY - 58,
            width: 170,
            height: 42,
            label: this.metronomeEnabled ? 'METRO ON' : 'METRONOME',
            fontSize: 14,
            onClick: () => this.toggleMetronome(),
        });
        this.metronomeButton.setDisabled(this.mode === 'playback');
        this.pianoGroup.add(this.metronomeButton);

        this.bottomPedalButton = new ToonButton({
            scene: this,
            x: width / 2,
            y: startY + whiteKeyHeight + 34,
            width: 180,
            height: 42,
            label: this.bottomPedalEnabled ? 'SUSTAIN ON' : 'SUSTAIN',
            fontSize: 14,
            onClick: () => this.toggleBottomPedal(),
        });
        this.bottomPedalButton.setDisabled(this.mode === 'playback');
        this.pianoGroup.add(this.bottomPedalButton);
    }

    private createSideControls(x: number, centerY: number) {
        const gap = 56;
        const up = this.createHoldControl('OCT +', x, centerY - gap, () => this.setOctaveHold(`up:${x}`, 1), () => this.clearOctaveHold(`up:${x}`));
        const pedal = this.createHoldControl('PEDAL', x, centerY, () => this.setSidePedal(`pedal:${x}`, true), () => this.setSidePedal(`pedal:${x}`, false));
        const down = this.createHoldControl('OCT -', x, centerY + gap, () => this.setOctaveHold(`down:${x}`, -1), () => this.clearOctaveHold(`down:${x}`));

        if (this.mode === 'playback') {
            up.background.disableInteractive();
            pedal.background.disableInteractive();
            down.background.disableInteractive();
            up.container.setAlpha(0.55);
            pedal.container.setAlpha(0.55);
            down.container.setAlpha(0.55);
        }

        this.pianoGroup.add([up.container, pedal.container, down.container]);
    }

    private createHoldControl(
        label: string,
        x: number,
        y: number,
        onDown: () => void,
        onUp: () => void
    ): HoldControl {
        const width = 66;
        const height = 42;
        const container = this.add.container(x, y);
        const background = this.add.rectangle(0, 0, width, height, 0xf8d66d)
            .setStrokeStyle(3, 0x2f2118);
        const text = this.add.text(0, 0, label, {
            color: '#2f2118',
            fontSize: '12px',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5);

        container.add([background, text]);
        container.setSize(width, height);
        background.setInteractive({ useHandCursor: true });
        background.on('pointerdown', () => {
            background.setFillStyle(0xffec99);
            onDown();
        });

        const release = () => {
            background.setFillStyle(0xf8d66d);
            onUp();
        };

        background.on('pointerup', release);
        background.on('pointerout', release);
        background.on('pointerupoutside', release);

        return { container, background };
    }

    private setupKeyboardInput() {
        if (!this.input.keyboard || this.mode !== 'compose') return;

        this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
            if (this.isInputBlocked()) return;

            const keyName = event.key.toUpperCase();
            const note = KEYBOARD_MAP[keyName];

            if (note) {
                void this.playNote(note, `keyboard:${keyName}`);
                return;
            }

            if (keyName === 'Q') this.setOctaveHold('keyboard:Q', -1);
            if (keyName === 'E') this.setOctaveHold('keyboard:E', 1);
            if (keyName === 'W') this.setSidePedal('keyboard:W', true);
            if (keyName === ' ') this.toggleBottomPedal();
        });

        this.input.keyboard.on('keyup', (event: KeyboardEvent) => {
            if (this.isInputBlocked()) return;

            const keyName = event.key.toUpperCase();

            if (KEYBOARD_MAP[keyName]) {
                this.stopNote(`keyboard:${keyName}`);
                return;
            }

            if (keyName === 'Q') this.clearOctaveHold('keyboard:Q');
            if (keyName === 'E') this.clearOctaveHold('keyboard:E');
            if (keyName === 'W') this.setSidePedal('keyboard:W', false);
        });
    }

    private isInputBlocked() {
        return this.dialog.visible || this.confirmDialog.visible || this.saveDialog.visible;
    }

    private handleBack() {
        if (this.mode === 'compose') {
            this.confirmDialog.open({
                title: 'LEAVE STUDIO?',
                message: 'Your unsaved tune will fade out.',
                confirmLabel: 'Leave',
                onConfirm: () => {
                    this.scene.start('MainMenu');
                },
            });
            return;
        }

        this.stopPlayback();
        this.scene.start(this.returnScene);
    }

    private openInfo() {
        if (this.mode === 'compose') {
            this.dialog.open(`
                Hit RECORD, play the keys, then SAVE.
                Save checks for at least 10 piano key presses.
                Q/E shift octaves, W holds the side pedal, Space toggles sustain.
            `);
            return;
        }

        this.dialog.open('Playback mode shows the recorded tune on the keys. Use pause or restart any time.');
    }

    private handleRecordButton() {
        if (!this.isRecording && !this.recordingStopped) {
            this.startRecording();
            return;
        }

        if (this.isRecording) {
            this.stopRecording();
            return;
        }

        this.confirmDialog.open({
            title: 'CLEAR TAKE?',
            message: 'This removes the current recording so you can start fresh.',
            confirmLabel: 'Clear',
            onConfirm: () => this.clearRecording(),
        });
    }

    private startRecording() {
        this.timeline = [];
        this.noteCount = 0;
        this.recordStartedAt = null;
        this.recordingElapsedMs = 0;
        this.isRecording = true;
        this.recordingStopped = false;
        this.recordButton?.setLabel('STOP');
        this.timeTimer?.remove(false);
        this.timeTimer = this.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => this.updateTimeText(),
        });
        this.updateStatus();
    }

    private stopRecording() {
        if (this.recordStartedAt !== null) {
            this.recordingElapsedMs = this.getRecordingElapsedMs();
        }

        this.releaseAllNotes();
        this.isRecording = false;
        this.recordingStopped = true;
        this.timeTimer?.remove(false);
        this.recordButton?.setLabel('CLEAR');
        this.updateStatus();
    }

    private clearRecording() {
        this.releaseAllNotes();
        this.timeline = [];
        this.noteCount = 0;
        this.recordStartedAt = null;
        this.recordingElapsedMs = 0;
        this.isRecording = false;
        this.recordingStopped = false;
        this.lastRecordSignature = '';
        this.lastRecordTime = -1;
        this.recordButton?.setLabel('RECORD');
        this.updateStatus();
    }

    private async saveTrack() {
        if (this.isRecording) this.stopRecording();

        if (this.noteCount < 10) {
            this.dialog.open('Too short, Maestro! Pluck more keys!');
            return;
        }

        this.saveDialog.open({
            initialName: this.track?.name ?? this.createDefaultTrackName(),
            onSave: (name) => this.persistTrack(name),
        });
    }

    private async persistTrack(name: string) {
        try {
            const savedTrack = await RedditAPI.saveTrack({
                name,
                timeline: this.timeline,
                instrumentId: this.currentInstrument,
                durationMs: this.recordingElapsedMs,
                noteCount: this.noteCount,
            });
            this.track = savedTrack;
            this.updateTrackActionButtons();
            this.dialog.open(`Saved! Publish it later to earn ${PUBLISH_REWARD} notes, or keep it as a draft.`);
        } catch (error) {
            if (error instanceof Error) throw error;
            throw new Error('Save failed', { cause: error });
        }
    }

    private createDefaultTrackName() {
        return 'Toon Tune';
    }

    private getInstrumentLabel(instrument: InstrumentOption) {
        if (instrument.id === InstrumentId.DEFAULT_PIANO) return 'P';
        if (instrument.id === InstrumentId.SYNTH_PIANO) return 'S';
        if (instrument.id === InstrumentId.ORGAN) return 'O';
        if (instrument.id === InstrumentId.RETRO) return 'R';
        return 'E';
    }

    private confirmPublishTrack() {
        if (!this.track) return;

        this.confirmDialog.open({
            title: 'PUBLISH RECORD?',
            message: `After publishing, this tune stays in post history, cannot be deleted from your list, and pays a ${PUBLISH_REWARD} note reward.`,
            confirmLabel: 'Publish',
            onConfirm: async () => {
                await this.publishCurrentTrack();
            },
        });
    }

    private confirmDeleteTrack() {
        if (!this.track) return;

        this.confirmDialog.open({
            title: 'DELETE RECORD?',
            message: 'This saved draft will disappear from your vinyl shelf.',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                await this.deleteCurrentTrack();
            },
        });
    }

    private async publishCurrentTrack() {
        if (!this.track) return;

        try {
            const response = await RedditAPI.publishTrack({ trackId: this.track.id });
            this.track = {
                ...this.track,
                isPublished: true,
            };

            if (this.user) {
                this.user = {
                    ...this.user,
                    notes: this.user.notes + response.bonusNotes,
                };
                this.registry.set('user', this.user);
            }

            this.updateTrackActionButtons();
            this.dialog.open(`Published! You earned ${response.bonusNotes} notes.\nPost: ${response.postId}`);
        } catch (error) {
            this.dialog.open(error instanceof Error ? error.message : 'Publish failed');
        }
    }

    private async deleteCurrentTrack() {
        if (!this.track) return;

        try {
            await RedditAPI.deleteTrack({ trackId: this.track.id });
            this.track = undefined;
            this.updateTrackActionButtons();

            if (this.mode === 'playback') {
                this.scene.start('UserRecordsScene');
                return;
            }

            this.dialog.open('Draft deleted. Your current take is still here if you want to save again.');
        } catch (error) {
            this.dialog.open(error instanceof Error ? error.message : 'Delete failed');
        }
    }

    private updateTrackActionButtons() {
        const canManageDraft = Boolean(
            this.track
            && !this.track.isPublished
            && this.user
            && this.track.userId === this.user.id
        );

        this.publishButton?.setVisible(canManageDraft);
        this.deleteTrackButton?.setVisible(canManageDraft);
    }

    private async playNote(noteName: string, inputId: string) {
        if (this.activeNotes[inputId]) return;

        const fullNote = `${noteName}${4 + this.currentOctaveOffset}`;
        this.activeNotes[inputId] = fullNote;
        this.releaseSustainedNote(fullNote);
        this.highlightKey(noteName, true);

        if (this.isRecording) {
            this.ensureRecordingStarted();
            this.recordEvent(PianoEventType.NoteOn, fullNote);
            this.noteCount += 1;
        }

        await this.ensureAudioReady();
        if (this.activeNotes[inputId] !== fullNote) return;

        this.synth.triggerAttack(fullNote);
        this.triggeredInputs.add(inputId);
    }

    private stopNote(inputId: string) {
        const fullNote = this.activeNotes[inputId];
        if (!fullNote) return;

        this.highlightKey(this.getNoteName(fullNote), false);

        if (this.isRecording) {
            this.recordEvent(PianoEventType.NoteOff, fullNote);
        }

        delete this.activeNotes[inputId];
        if (!this.triggeredInputs.has(inputId)) return;

        if (this.isPedalActive()) {
            this.sustainedNotes.add(fullNote);
        } else {
            this.releaseNote(fullNote);
        }
        this.triggeredInputs.delete(inputId);
    }

    private ensureRecordingStarted() {
        if (this.recordStartedAt !== null) return;

        this.recordStartedAt = this.time.now;
        this.recordingElapsedMs = 0;
        if (this.isPedalActive()) {
            this.recordEvent(PianoEventType.PedalToggle, true);
        }
        if (this.currentOctaveOffset !== 0) {
            this.recordEvent(PianoEventType.OctaveSet, this.currentOctaveOffset);
        }
        this.updateTimeText();
    }

    private recordEvent(type: PianoEventType, value: string | number | boolean) {
        if (!this.isRecording || this.recordStartedAt === null) return;
        if (this.timeline.length >= this.maxTimelineEvents) return;

        const eventTime = Math.round(this.getRecordingElapsedMs());
        const signature = `${type}:${String(value)}`;
        if (signature === this.lastRecordSignature && eventTime - this.lastRecordTime < 8) return;

        this.timeline.push({ time: eventTime, type, value });
        this.lastRecordSignature = signature;
        this.lastRecordTime = eventTime;

        if (eventTime >= this.getMaxDurationMs()) {
            this.stopRecording();
        }
    }

    private setOctaveHold(source: string, offset: number) {
        if (this.mode !== 'compose') return;

        this.octaveHolds.set(source, offset);
        this.currentOctaveOffset = this.resolveOctaveOffset();
        if (this.isRecording && this.recordStartedAt !== null) {
            this.recordEvent(PianoEventType.OctaveSet, this.currentOctaveOffset);
        }
        this.updateStatus();
    }

    private clearOctaveHold(source: string) {
        if (this.mode !== 'compose') return;

        this.octaveHolds.delete(source);
        this.currentOctaveOffset = this.resolveOctaveOffset();
        if (this.isRecording && this.recordStartedAt !== null) {
            this.recordEvent(PianoEventType.OctaveSet, this.currentOctaveOffset);
        }
        this.updateStatus();
    }

    private resolveOctaveOffset() {
        const values = [...this.octaveHolds.values()];
        if (values.includes(1)) return 1;
        if (values.includes(-1)) return -1;
        return 0;
    }

    private setSidePedal(source: string, isDown: boolean) {
        if (this.mode !== 'compose') return;

        const wasActive = this.isPedalActive();
        if (isDown) {
            this.heldSidePedals.add(source);
        } else {
            this.heldSidePedals.delete(source);
        }

        const isActive = this.isPedalActive();
        if (wasActive && !isActive) this.releaseSustainedNotes();
        if (wasActive !== isActive && this.isRecording && this.recordStartedAt !== null) {
            this.recordEvent(PianoEventType.PedalToggle, isActive);
        }
        this.updateStatus();
    }

    private toggleBottomPedal() {
        if (this.mode !== 'compose') return;

        const wasActive = this.isPedalActive();
        this.bottomPedalEnabled = !this.bottomPedalEnabled;
        const isActive = this.isPedalActive();
        if (wasActive && !isActive) this.releaseSustainedNotes();
        if (wasActive !== isActive && this.isRecording && this.recordStartedAt !== null) {
            this.recordEvent(PianoEventType.PedalToggle, isActive);
        }
        this.bottomPedalButton?.setLabel(this.bottomPedalEnabled ? 'SUSTAIN ON' : 'SUSTAIN');
        this.updateStatus();
    }

    private async toggleMetronome() {
        if (this.mode !== 'compose') return;

        this.metronomeEnabled = !this.metronomeEnabled;
        this.metronomeButton?.setLabel(this.metronomeEnabled ? 'METRO ON' : 'METRONOME');

        if (this.metronomeEnabled) {
            await this.ensureAudioReady();
            this.ensureMetronomeClickSynth();
            this.metronomeBeat = 0;
            this.playMetronomeClick();
            this.metronomeTimer = this.time.addEvent({
                delay: METRONOME_INTERVAL_MS,
                loop: true,
                callback: () => {
                    this.playMetronomeClick();
                    this.metronomeButton?.setScale(1.08);
                    this.time.delayedCall(80, () => this.metronomeButton?.setScale(1));
                },
            });
        } else {
            this.metronomeTimer?.remove(false);
            this.metronomeButton?.setScale(1);
        }

        if (this.isRecording && this.recordStartedAt !== null) {
            this.recordEvent(PianoEventType.MetronomeToggle, this.metronomeEnabled);
        }
    }

    private ensureMetronomeClickSynth() {
        if (this.metronomeClickSynth) return;

        this.metronomeClickSynth = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: {
                attack: 0.001,
                decay: 0.035,
                sustain: 0,
                release: 0.035,
                releaseCurve: 'exponential',
            },
            volume: -18,
        }).toDestination();
    }

    private playMetronomeClick() {
        if (!this.metronomeClickSynth) return;

        const isTick = this.metronomeBeat % 2 === 0;
        this.metronomeClickSynth.triggerAttackRelease(isTick ? 'C6' : 'G5', '32n', undefined, isTick ? 0.42 : 0.32);
        this.metronomeBeat += 1;
    }

    private isPedalActive() {
        return this.bottomPedalEnabled || this.heldSidePedals.size > 0;
    }

    private getRecordingElapsedMs() {
        if (this.recordStartedAt === null) return this.recordingElapsedMs;

        return Math.min(this.time.now - this.recordStartedAt, this.getMaxDurationMs());
    }

    private getMaxDurationMs() {
        return (this.user?.maxTrackDuration ?? 30) * 1000;
    }

    private updateTimeText() {
        if (this.mode !== 'compose') {
            this.timeText.setText('');
            return;
        }

        const remainingMs = Math.max(this.getMaxDurationMs() - this.getRecordingElapsedMs(), 0);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = String(remainingSeconds % 60).padStart(2, '0');

        this.timeText.setText(`TIME ${minutes}:${seconds}`);

        if (remainingMs <= 0 && this.isRecording) this.stopRecording();
    }

    private updateStatus() {
        this.updateTimeText();
    }

    private async startPlayback() {
        if (!this.track || this.isPlaying) return;
        await this.ensureAudioReady();

        this.isPlaying = true;
        this.playbackPedalActive = false;
        this.playbackStartedAt = this.time.now;
        this.playButton?.setLabel('PAUSE');

        this.track.timeline
            .filter((event) => event.time >= this.playbackOffsetMs)
            .forEach((event) => {
                const timer = this.time.delayedCall(event.time - this.playbackOffsetMs, () => this.applyPlaybackEvent(event));
                this.playbackTimers.push(timer);
            });

        const duration = Math.max(this.track.durationMs - this.playbackOffsetMs, 0);
        const finishTimer = this.time.delayedCall(duration + PLAYBACK_RELEASE_TAIL_MS, () => {
            this.stopPlayback();
            this.playbackOffsetMs = 0;
            this.playButton?.setLabel('PLAY');
        });
        this.playbackTimers.push(finishTimer);
    }

    private togglePlayback() {
        if (this.isPlaying) {
            this.pausePlayback();
            return;
        }

        void this.startPlayback();
    }

    private pausePlayback() {
        if (!this.isPlaying) return;

        this.playbackOffsetMs += this.time.now - this.playbackStartedAt;
        this.stopPlayback(false);
        this.playButton?.setLabel('PLAY');
    }

    private restartPlayback() {
        this.stopPlayback();
        this.playbackOffsetMs = 0;
        void this.startPlayback();
    }

    private stopPlayback(resetOffset = true) {
        this.playbackTimers.forEach((timer) => timer.remove(false));
        this.playbackTimers = [];
        this.releaseAllNotes();
        this.isPlaying = false;
        this.playbackPedalActive = false;
        this.bottomPedalButton?.setLabel('SUSTAIN');
        if (resetOffset) this.playbackStartedAt = 0;
    }

    private applyPlaybackEvent(event: PianoEvent) {
        if (event.type === PianoEventType.NoteOn && typeof event.value === 'string') {
            this.releaseSustainedNote(event.value);
            this.synth.triggerAttack(event.value);
            this.activeNotes[`playback:${event.value}`] = event.value;
            this.highlightKey(this.getNoteName(event.value), true);
            return;
        }

        if (event.type === PianoEventType.NoteOff && typeof event.value === 'string') {
            if (this.playbackPedalActive) {
                this.sustainedNotes.add(event.value);
            } else {
                this.releaseNote(event.value);
            }
            delete this.activeNotes[`playback:${event.value}`];
            this.highlightKey(this.getNoteName(event.value), false);
            return;
        }

        if (event.type === PianoEventType.PedalToggle && typeof event.value === 'boolean') {
            const wasActive = this.playbackPedalActive;
            this.playbackPedalActive = event.value;
            if (wasActive && !this.playbackPedalActive) this.releaseSustainedNotes();
            this.bottomPedalButton?.setLabel(event.value ? 'SUSTAIN ON' : 'SUSTAIN');
        }
    }

    private releaseAllNotes() {
        Object.keys(this.activeNotes).forEach((key) => {
            const note = this.activeNotes[key];
            if (note) {
                this.releaseNote(note);
                this.triggeredInputs.delete(key);
                this.highlightKey(this.getNoteName(note), false);
            }
            delete this.activeNotes[key];
        });
        this.releaseSustainedNotes();
    }

    private releaseSustainedNotes() {
        this.sustainedNotes.forEach((note) => {
            this.releaseNote(note);
        });
        this.sustainedNotes.clear();
    }

    private releaseSustainedNote(note: string) {
        if (!this.sustainedNotes.has(note)) return;

        this.releaseNote(note);
        this.sustainedNotes.delete(note);
    }

    private releaseNote(note: string) {
        this.synth.triggerRelease(note);
    }

    private highlightKey(noteName: string, isDown: boolean) {
        const key = this.keyVisuals.get(noteName);
        if (!key) return;

        key.setAlpha(isDown ? 0.62 : 1);
    }

    private getNoteName(fullNote: string) {
        return fullNote.replace(/[0-9]/g, '');
    }

    private getInitialInstrument() {
        if (this.track?.instrumentId) {
            return this.getInstrumentById(this.track.instrumentId);
        }

        return InstrumentId.DEFAULT_PIANO;
    }

    private getInstrumentById(id: string) {
        const found = Object.values(InstrumentId).find((instrument) => instrument === id);
        return found ?? InstrumentId.DEFAULT_PIANO;
    }

    private getAvailableInstruments(): InstrumentOption[] {
        const instruments: InstrumentOption[] = [
            { id: InstrumentId.DEFAULT_PIANO, name: 'PIANO' },
        ];

        this.user?.purchasedItems.forEach((item) => {
            const instrument = SHOP_INSTRUMENTS[item];
            if (instrument) instruments.push(instrument);
        });

        return instruments;
    }

    private changeInstrument(instrument: InstrumentId) {
        if (this.synth) this.synth.dispose();

        this.currentInstrument = instrument;
        if (isSampledInstrument(instrument)) {
            const preloadedSamples = this.getPreloadedSampleBuffers(instrument);
            if (preloadedSamples) {
                this.instrumentReady = Promise.resolve();
                this.synth = new Tone.Sampler({
                    urls: preloadedSamples,
                    release: NOTE_RELEASE_SECONDS,
                }).toDestination();
                return;
            }

            this.instrumentReady = new Promise((resolve) => {
                const sampler = new Tone.Sampler({
                    urls: this.getFallbackSampleUrls(instrument),
                    baseUrl: `./assets/audio/${instrument === InstrumentId.DEFAULT_PIANO ? 'piano' : 'organ'}/`,
                    release: NOTE_RELEASE_SECONDS,
                    onload: resolve,
                }).toDestination();

                this.synth = sampler;
            });
            return;
        }

        this.instrumentReady = Promise.resolve();
        if (instrument === InstrumentId.ELECTRO) {
            const synth = new Tone.PolySynth(Tone.FMSynth).toDestination();
            synth.set({
                envelope: { attack: 0.01, decay: 0.12, sustain: 0.55, release: NOTE_RELEASE_SECONDS, releaseCurve: 'exponential' },
            });
            this.synth = synth;
            return;
        }

        if (instrument === InstrumentId.RETRO) {
            const synth = new Tone.PolySynth(Tone.MonoSynth).toDestination();
            synth.set({
                envelope: { attack: 0.01, decay: 0.12, sustain: 0.55, release: NOTE_RELEASE_SECONDS, releaseCurve: 'exponential' },
            });
            this.synth = synth;
            return;
        }

        const synth = new Tone.PolySynth(Tone.Synth).toDestination();
        synth.set({
            envelope: { attack: 0.01, decay: 0.12, sustain: 0.55, release: NOTE_RELEASE_SECONDS, releaseCurve: 'exponential' },
        });
        this.synth = synth;
    }

    private getPreloadedSampleBuffers(instrument: SampledInstrumentId): Record<string, AudioBuffer> | null {
        const buffers: Record<string, AudioBuffer> = {};
        const samples = AUDIO_SAMPLE_ASSETS.filter((sample) => sample.instrument === instrument);

        for (const sample of samples) {
            const cachedBuffer: unknown = this.cache.audio.get(getSampleAudioKey(instrument, sample.note));
            if (!(cachedBuffer instanceof AudioBuffer)) return null;

            buffers[sample.note] = cachedBuffer;
        }

        return buffers;
    }

    private getFallbackSampleUrls(instrument: SampledInstrumentId): Record<string, string> {
        const urls: Record<string, string> = {};
        const samples = AUDIO_SAMPLE_ASSETS.filter((sample) => sample.instrument === instrument);

        samples.forEach((sample) => {
            urls[sample.note] = sample.path.split('/').at(-1) ?? '';
        });

        return urls;
    }

    private async ensureAudioReady() {
        if (Tone.context.state !== 'running') await Tone.start();
        await this.instrumentReady;
    }

    private shutdownScene() {
        this.scale.off('resize', this.resizeHandler);
        this.timeTimer?.remove(false);
        this.metronomeTimer?.remove(false);
        this.stopPlayback();
        this.metronomeClickSynth?.dispose();
        this.synth?.dispose();
    }
}
