import Phaser, { Scene } from 'phaser';
import * as Tone from 'tone';
import { ConfirmDialog } from '../UI/ConfirmDialog';
import { InfoDialog } from '../UI/InfoDialog';
import { SaveTrackDialog } from '../UI/SaveTrackDialog';
import { SpriteButton } from '../UI/SpriteButton';
import { RedditAPI } from '../utils/RedditAPI';
import { InstrumentId, PianoEventType, ShopItem } from '../../shared/api';
import { PUBLISH_REWARD } from '../../shared/economy';
import { coverSceneBackground } from '../utils/sceneBackground';
import { getInstrumentMiniTexture } from '../utils/instrumentMiniatures';
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
    button: SpriteButton;
};

type PianoKeyTier = 'down' | 'middle' | 'up';

type PianoKeyColor = 'white' | 'black';

type PianoKeyVisual = {
    sprite: Phaser.GameObjects.Sprite;
    color: PianoKeyColor;
};

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTES = [
    { note: 'C#', afterWhiteIndex: 0 },
    { note: 'D#', afterWhiteIndex: 1 },
    { note: 'F#', afterWhiteIndex: 3 },
    { note: 'G#', afterWhiteIndex: 4 },
    { note: 'A#', afterWhiteIndex: 5 },
];

const WHITE_KEY_FRAME = { width: 71, height: 124 };
const BLACK_KEY_FRAME = { width: 40, height: 62 };

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

const INSTRUMENT_BACKGROUND_ANIMS: Record<InstrumentId, string> = {
    [InstrumentId.DEFAULT_PIANO]: 'instrument_bg_piano',
    [InstrumentId.SYNTH_PIANO]: 'instrument_bg_synth',
    [InstrumentId.ORGAN]: 'instrument_bg_organ',
    [InstrumentId.RETRO]: 'instrument_bg_retro',
    [InstrumentId.ELECTRO]: 'instrument_bg_electro',
};

const NOTE_RELEASE_SECONDS = 0.42;
const PIANO_VOLUME_DB = -8;
const PIANO_LIMITER_DB = -1;
const PLAYBACK_RELEASE_TAIL_MS = 700;
const METRONOME_FRAME_MS = 125;

export class PianoScene extends Scene {
    private mode: PianoMode = 'compose';
    private returnScene = 'MainMenu';
    private track: TrackModel | undefined;
    private user: UserResponse | undefined;

    private synth: PlayableInstrument | undefined;
    private instrumentReady: Promise<void> = Promise.resolve();
    private currentInstrument: InstrumentId = InstrumentId.DEFAULT_PIANO;
    private activeNotes: Record<string, string> = {};
    private sustainedNotes = new Set<string>();
    private triggeredInputs = new Set<string>();
    private keyVisuals = new Map<string, PianoKeyVisual>();
    private pressedKeyVisuals = new Set<string>();
    private octaveHolds = new Map<string, number>();

    private background!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private timeText!: Phaser.GameObjects.Text;
    private pianoGroup!: Phaser.GameObjects.Container;
    private pianoBackground: Phaser.GameObjects.Sprite | undefined;
    private instrumentGroup!: Phaser.GameObjects.Container;
    private dialog!: InfoDialog;
    private confirmDialog!: ConfirmDialog;
    private saveDialog!: SaveTrackDialog;

    private backButton!: SpriteButton;
    private infoButton!: SpriteButton;
    private recordButton: SpriteButton | undefined;
    private saveButton: SpriteButton | undefined;
    private bottomPedalButton: Phaser.GameObjects.Sprite | undefined;
    private metronomeSprite: Phaser.GameObjects.Sprite | undefined;
    private playButton: SpriteButton | undefined;
    private restartButton: SpriteButton | undefined;
    private publishButton: SpriteButton | undefined;
    private deleteTrackButton: SpriteButton | undefined;

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
    private metronomeTimer: Phaser.Time.TimerEvent | undefined;
    private metronomeBeat = 0;
    private metronomeFrameStep = 0;
    private metronomeClickSynth: Tone.Synth | undefined;
    private timeTimer: Phaser.Time.TimerEvent | undefined;

    private playbackOffsetMs = 0;
    private playbackStartedAt = 0;
    private playbackPedalActive = false;
    private isPlaying = false;
    private playbackTimers: Phaser.Time.TimerEvent[] = [];
    private playbackStartTimer: Phaser.Time.TimerEvent | undefined;
    private resizeHandler = () => this.refreshLayout();
    private keyboardDownHandler = (event: KeyboardEvent) => this.handleKeyboardDown(event);
    private keyboardUpHandler = (event: KeyboardEvent) => this.handleKeyboardUp(event);

    constructor() {
        super('PianoScene');
    }

    // Reads scene mode and resets old runtime state
    init(data?: PianoSceneData) {
        this.resetRuntimeState();
        this.mode = data?.mode ?? (data?.track ? 'playback' : 'compose');
        this.track = data?.track;
        this.returnScene = data?.returnScene ?? (this.mode === 'playback' ? 'UserRecordsScene' : 'MainMenu');
    }

    // Clears state reused by Phaser scene restarts
    private resetRuntimeState() {
        this.user = undefined;
        this.instrumentReady = Promise.resolve();
        this.synth = undefined;
        this.currentInstrument = InstrumentId.DEFAULT_PIANO;
        this.activeNotes = {};
        this.sustainedNotes.clear();
        this.triggeredInputs.clear();
        this.keyVisuals.clear();
        this.pressedKeyVisuals.clear();
        this.octaveHolds.clear();
        this.pianoBackground = undefined;
        this.bottomPedalButton = undefined;
        this.metronomeSprite = undefined;
        this.recordButton = undefined;
        this.saveButton = undefined;
        this.playButton = undefined;
        this.restartButton = undefined;
        this.publishButton = undefined;
        this.deleteTrackButton = undefined;
        this.isRecording = false;
        this.recordingStopped = false;
        this.recordStartedAt = null;
        this.recordingElapsedMs = 0;
        this.timeline = [];
        this.noteCount = 0;
        this.lastRecordSignature = '';
        this.lastRecordTime = -1;
        this.bottomPedalEnabled = false;
        this.currentOctaveOffset = 0;
        this.metronomeEnabled = false;
        this.metronomeTimer = undefined;
        this.metronomeBeat = 0;
        this.metronomeFrameStep = 0;
        this.metronomeClickSynth = undefined;
        this.timeTimer = undefined;
        this.playbackOffsetMs = 0;
        this.playbackStartedAt = 0;
        this.playbackPedalActive = false;
        this.isPlaying = false;
        this.playbackTimers = [];
        this.playbackStartTimer = undefined;
    }

    // Builds the piano scene
    create() {
        this.user = this.registry.get('user');
        this.currentInstrument = this.getInitialInstrument();
        this.changeInstrument(this.currentInstrument);
        this.input.addPointer(5);

        this.background = this.add.image(0, 0, 'create_record_bg').setOrigin(0);

        this.pianoGroup = this.add.container(0, 0);
        this.instrumentGroup = this.add.container(0, 0);
        this.dialog = new InfoDialog({ scene: this });
        this.confirmDialog = new ConfirmDialog({ scene: this });
        this.saveDialog = new SaveTrackDialog({ scene: this });

        this.title = this.add.text(0, 0, this.mode === 'compose' ? 'COMPOSE\nA TUNE' : 'LISTENING\nBOOTH', {
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
            this.playbackStartTimer = this.time.delayedCall(250, () => {
                void this.startPlayback();
            });
        }
    }

    // Creates back and info buttons
    private createTopControls() {
        this.backButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 70,
            backgroundTexture: 'middle_round_button_bg',
            backgroundAnimation: 'middle_round_button_bg_active',
            iconTexture: 'middle_round_back_icon',
            iconAnimation: 'middle_round_back_icon_active',
            onClick: () => this.handleBack(),
        });

        this.infoButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 70,
            backgroundTexture: 'middle_round_button_bg',
            backgroundAnimation: 'middle_round_button_bg_active',
            iconTexture: 'middle_round_info_icon',
            iconAnimation: 'middle_round_info_icon_active',
            onClick: () => this.openInfo(),
        });
    }

    // Creates compose or playback controls
    private createModeControls() {
        if (this.mode === 'compose') {
            this.recordButton = new SpriteButton({
                scene: this,
                x: 0,
                y: 0,
                size: 58,
                backgroundTexture: 'small_round_button_bg',
                backgroundAnimation: 'small_round_button_bg_active',
                iconTexture: 'small_round_record_icon',
                iconAnimation: 'small_round_record_icon_active',
                onClick: () => this.handleRecordButton(),
            });

            this.saveButton = new SpriteButton({
                scene: this,
                x: 0,
                y: 0,
                size: 58,
                backgroundTexture: 'small_round_button_bg',
                backgroundAnimation: 'small_round_button_bg_active',
                iconTexture: 'small_round_save_icon',
                iconAnimation: 'small_round_save_icon_active',
                onClick: () => this.saveTrack(),
            });

            this.createInstrumentButtons();
            return;
        }

        this.playButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 58,
            backgroundTexture: 'small_round_button_bg',
            backgroundAnimation: 'small_round_button_bg_active',
            iconTexture: 'small_round_play_icon',
            iconAnimation: 'small_round_play_icon_active',
            onClick: () => this.togglePlayback(),
        });

        this.restartButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 58,
            backgroundTexture: 'small_round_button_bg',
            backgroundAnimation: 'small_round_button_bg_active',
            iconTexture: 'small_round_replay_icon',
            iconAnimation: 'small_round_replay_icon_active',
            onClick: () => this.restartPlayback(),
        });
    }

    // Creates hidden draft action buttons
    private createTrackActionButtons() {
        this.publishButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 50,
            backgroundTexture: 'small_square_button_bg',
            backgroundAnimation: 'small_square_button_bg_active',
            backgroundDisabledFrame: 3,
            iconTexture: 'small_square_done_icon',
            iconAnimation: 'small_square_done_icon_active',
            onClick: () => this.confirmPublishTrack(),
        });

        this.deleteTrackButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 50,
            backgroundTexture: 'small_square_button_bg',
            backgroundAnimation: 'small_square_button_bg_active',
            backgroundDisabledFrame: 3,
            iconTexture: 'small_square_remove_icon',
            iconAnimation: 'small_square_remove_icon_active',
            onClick: () => this.confirmDeleteTrack(),
        });

        this.publishButton.setVisible(false);
        this.deleteTrackButton.setVisible(false);
    }

    // Creates instrument selector buttons
    private createInstrumentButtons() {
        this.instrumentGroup.removeAll(true);

        this.getAvailableInstruments().forEach((instrument) => {
            const miniTexture = getInstrumentMiniTexture(instrument.id);
            const button = new SpriteButton({
                scene: this,
                x: 0,
                y: 0,
                size: 50,
                backgroundTexture: miniTexture,
                backgroundAnimation: `${miniTexture}_active`,
                backgroundDisabledFrame: 8,
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

    // Repositions all piano scene UI
    private refreshLayout() {
        const { width, height } = this.scale;
        const titleY = Math.max(48, height * 0.075);
        const titleWidth = Math.max(150, Math.min(260, width - 150));

        this.cameras.resize(width, height);
        coverSceneBackground(this.background, width, height);
        this.title.setPosition(width / 2, titleY);
        this.title.setFontSize(Math.max(26, Math.min(38, width * 0.046)));
        this.title.setWordWrapWidth(titleWidth);
        this.backButton.setPosition(42, 42);
        this.infoButton.setPosition(width - 42, 42);

        if (this.mode === 'compose') {
            this.saveButton?.setPosition(width - 34, 112);
            this.recordButton?.setPosition(width - 34, 176);
            const instrumentBottom = this.layoutInstrumentButtons(width, titleY + 62);
            this.timeText.setPosition(width / 2, instrumentBottom + 28);
        } else {
            this.playButton?.setPosition(width - 34, 112);
            this.restartButton?.setPosition(width - 34, 176);
        }

        this.publishButton?.setPosition(width - 34, 238);
        this.deleteTrackButton?.setPosition(width - 34, 296);

        this.drawPianoRig(width, height);
        this.updateTrackActionButtons();
    }

    // Centers instrument buttons in one or two rows
    private layoutInstrumentButtons(width: number, y: number) {
        const buttons = this.instrumentGroup.list.filter((child) => child instanceof SpriteButton);
        const buttonSize = 50;
        const gap = 8;
        const maxButtonsPerRow = buttons.length <= 3 ? Math.max(1, buttons.length) : 3;
        const rowStep = buttonSize + 6;

        buttons.forEach((button, index) => {
            const row = Math.floor(index / maxButtonsPerRow);
            const col = index % maxButtonsPerRow;
            const rowStartIndex = row * maxButtonsPerRow;
            const itemsInRow = Math.min(maxButtonsPerRow, buttons.length - rowStartIndex);
            const rowWidth = itemsInRow * buttonSize + (itemsInRow - 1) * gap;
            const startX = width / 2 - rowWidth / 2 + buttonSize / 2;
            button.setPosition(startX + col * (buttonSize + gap), y + row * rowStep);
        });

        const rowCount = Math.max(1, Math.ceil(buttons.length / maxButtonsPerRow));
        return y + (rowCount - 1) * rowStep + buttonSize / 2;
    }

    // Draws the animated piano and playable keys
    private drawPianoRig(width: number, height: number) {
        this.pianoGroup.removeAll(true);
        this.keyVisuals.clear();
        this.pressedKeyVisuals.clear();
        this.metronomeSprite = undefined;
        this.bottomPedalButton = undefined;
        this.pianoBackground = undefined;

        const pianoBackground = this.add.sprite(0, 0, 'piano_hold_bg');
        const pianoBackgroundHeight = height * 0.55;
        const pianoBackgroundScale = pianoBackgroundHeight / (pianoBackground.height || 1);
        const pianoBackgroundWidth = pianoBackground.width * pianoBackgroundScale;
        const bottomControlGap = 10;
        const bottomControlHeight = 42;
        const bottomMargin = -28;
        const pianoBackgroundY = height - bottomMargin - bottomControlHeight - bottomControlGap - pianoBackgroundHeight / 2;
        const pianoBackgroundBottom = pianoBackgroundY + pianoBackgroundHeight / 2;
        const availableKeyWidth = Math.min(width * 0.96, pianoBackgroundWidth * 0.9);
        const whiteKeyScale = availableKeyWidth / (WHITE_NOTES.length * WHITE_KEY_FRAME.width);
        const whiteKeyWidth = WHITE_KEY_FRAME.width * whiteKeyScale;
        const whiteKeyHeight = WHITE_KEY_FRAME.height * whiteKeyScale;
        const pianoWidth = whiteKeyWidth * WHITE_NOTES.length;
        const startX = width / 2 - pianoWidth / 2;
        const keyVerticalOffset = pianoBackgroundHeight * 0.12;
        const startY = pianoBackgroundY - whiteKeyHeight / 2 + keyVerticalOffset;

        pianoBackground.setOrigin(0.5);
        pianoBackground.setPosition(width / 2, pianoBackgroundY);
        pianoBackground.setScale(pianoBackgroundScale);
        this.pianoBackground = pianoBackground;
        this.updateInstrumentBackgroundVisual();
        this.pianoGroup.add(pianoBackground);

        WHITE_NOTES.forEach((note, index) => {
            const key = this.add.sprite(
                startX + index * whiteKeyWidth,
                startY,
                this.getKeyTexture('white')
            ).setOrigin(0);
            key.setScale(whiteKeyScale);
            this.playKeyAnimation(key, 'white', false);

            if (this.mode === 'compose') {
                key.setInteractive({ useHandCursor: true });
                key.on('pointerdown', () => {
                    void this.playNote(note, `pointer:${note}`);
                });
                key.on('pointerup', () => this.stopNote(`pointer:${note}`));
                key.on('pointerout', () => this.stopNote(`pointer:${note}`));
            }

            this.keyVisuals.set(note, { sprite: key, color: 'white' });
            this.pianoGroup.add(key);
        });

        BLACK_NOTES.forEach(({ note, afterWhiteIndex }) => {
            const blackWidth = whiteKeyWidth * 0.62;
            const blackKeyScale = blackWidth / BLACK_KEY_FRAME.width;
            const x = startX + (afterWhiteIndex + 1) * whiteKeyWidth - blackWidth / 2;
            const key = this.add.sprite(x, startY, this.getKeyTexture('black'))
                .setOrigin(0);
            key.setScale(blackKeyScale);
            this.playKeyAnimation(key, 'black', false);

            if (this.mode === 'compose') {
                key.setInteractive({ useHandCursor: true });
                key.on('pointerdown', () => {
                    void this.playNote(note, `pointer:${note}`);
                });
                key.on('pointerup', () => this.stopNote(`pointer:${note}`));
                key.on('pointerout', () => this.stopNote(`pointer:${note}`));
            }

            this.keyVisuals.set(note, { sprite: key, color: 'black' });
            this.pianoGroup.add(key);
        });

        const bottomControlY = pianoBackgroundBottom - bottomControlHeight * 0.4;
        const octaveControlY = Math.min(bottomControlY + 8, height - 33);

        if (this.mode === 'compose') {
            this.createOctaveControls(Math.max(58, startX + 48), octaveControlY, 'left');
            this.createOctaveControls(Math.min(width - 58, startX + pianoWidth - 48), octaveControlY, 'right');

            this.metronomeSprite = this.add.sprite(34, 142, 'metronome')
                .setOrigin(0.5);
            this.updateMetronomeVisual();
            this.metronomeSprite.setInteractive({ useHandCursor: true });
            this.metronomeSprite.on('pointerdown', () => {
                void this.toggleMetronome();
            });
            this.pianoGroup.add(this.metronomeSprite);
        }

        if (this.supportsSustainPedal()) {
            this.bottomPedalButton = this.add.sprite(width / 2, bottomControlY - 5, 'sustain')
                .setOrigin(0.5)
                .setScale(pianoBackgroundScale);
            this.updateSustainPedalVisual(this.mode === 'playback' ? this.playbackPedalActive : this.bottomPedalEnabled);

            if (this.mode === 'compose') {
                this.bottomPedalButton.setInteractive({ useHandCursor: true });
                this.bottomPedalButton.on('pointerdown', () => this.toggleBottomPedal());
            }

            this.pianoGroup.add(this.bottomPedalButton);
        } else {
            this.bottomPedalButton = undefined;
        }
    }

    // Switches the piano background animation
    private updateInstrumentBackgroundVisual() {
        const pianoBackground = this.pianoBackground;
        if (!pianoBackground?.scene || !pianoBackground.active || !pianoBackground.anims) return;

        const animationKey = INSTRUMENT_BACKGROUND_ANIMS[this.currentInstrument];
        if (this.anims.exists(animationKey)) pianoBackground.play(animationKey, true);
    }

    // Creates octave controls for one side
    private createOctaveControls(x: number, y: number, side: string) {
        const gap = 32;
        const down = this.createHoldControl(
            x - gap,
            y,
            false,
            () => this.setOctaveHold(`${side}:down`, -1),
            () => this.clearOctaveHold(`${side}:down`)
        );
        const up = this.createHoldControl(
            x + gap,
            y,
            true,
            () => this.setOctaveHold(`${side}:up`, 1),
            () => this.clearOctaveHold(`${side}:up`)
        );

        this.pianoGroup.add([down.button, up.button]);
    }

    // Creates one hold-style octave button
    private createHoldControl(
        x: number,
        y: number,
        flipX: boolean,
        onDown: () => void,
        onUp: () => void
    ): HoldControl {
        const button = new SpriteButton({
            scene: this,
            x,
            y,
            size: 50,
            backgroundTexture: 'small_square_button_bg',
            backgroundAnimation: 'small_square_button_bg_active',
            backgroundDisabledFrame: 3,
            iconTexture: 'small_square_oct_icon',
            iconAnimation: 'small_square_oct_icon_active',
            flipX,
            onPress: onDown,
            onRelease: onUp,
        });

        return { button };
    }

    // Subscribes keyboard controls
    private setupKeyboardInput() {
        if (!this.input.keyboard || this.mode !== 'compose') return;

        this.input.keyboard.off('keydown', this.keyboardDownHandler);
        this.input.keyboard.off('keyup', this.keyboardUpHandler);
        this.input.keyboard.on('keydown', this.keyboardDownHandler);
        this.input.keyboard.on('keyup', this.keyboardUpHandler);
    }

    // Handles keyboard note and control presses
    private handleKeyboardDown(event: KeyboardEvent) {
        if (this.isInputBlocked()) return;

        const keyName = event.key.toUpperCase();
        const note = KEYBOARD_MAP[keyName];

        if (note) {
            void this.playNote(note, `keyboard:${keyName}`);
            return;
        }

        if (keyName === ',') this.setOctaveHold('keyboard:,', -1);
        if (keyName === '.') this.setOctaveHold('keyboard:.', 1);
        if (keyName === ' ') this.toggleBottomPedal();
    }

    // Handles keyboard note and control releases
    private handleKeyboardUp(event: KeyboardEvent) {
        if (this.isInputBlocked()) return;

        const keyName = event.key.toUpperCase();

        if (KEYBOARD_MAP[keyName]) {
            this.stopNote(`keyboard:${keyName}`);
            return;
        }

        if (keyName === ',') this.clearOctaveHold('keyboard:,');
        if (keyName === '.') this.clearOctaveHold('keyboard:.');
    }

    // Checks if a dialog is blocking input
    private isInputBlocked() {
        return this.dialog.visible || this.confirmDialog.visible || this.saveDialog.visible;
    }

    // Handles leaving the piano scene
    private handleBack() {
        if (this.mode === 'compose') {
            this.confirmDialog.open({
                title: 'LEAVE\nSTUDIO?',
                message: 'Your unsaved tune will fade out',
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

    // Shows piano scene help
    private openInfo() {
        if (this.mode === 'compose') {
            this.dialog.open(`
                Hit RECORD, lay down at least 10 notes, and hit SAVE to press it straight into your Vinyl collection!
                \n[Z]...[M] White Keys, [S][D] [G][H][J] Black Keys, [, / .] Shift Octaves, [Space] Pedal Sustain
            `);
            return;
        }

        this.dialog.open('Playback mode shows the recorded tune on the keys. Use pause or restart any time');
    }

    // Advances the record button state
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
            message: 'This removes the current recording so you can start fresh',
            confirmLabel: 'Clear',
            onConfirm: () => this.clearRecording(),
        });
    }

    // Starts a fresh recording
    private startRecording() {
        this.timeline = [];
        this.noteCount = 0;
        this.recordStartedAt = null;
        this.recordingElapsedMs = 0;
        this.isRecording = true;
        this.recordingStopped = false;
        this.setRecordButtonIcon('small_round_stop_icon');
        this.timeTimer?.remove(false);
        this.timeTimer = this.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => this.updateTimeText(),
        });
        this.updateStatus();
    }

    // Stops recording and keeps the take
    private stopRecording() {
        if (this.recordStartedAt !== null) {
            this.recordingElapsedMs = this.getRecordingElapsedMs();
        }

        this.releaseAllNotes();
        this.isRecording = false;
        this.recordingStopped = true;
        this.timeTimer?.remove(false);
        this.setRecordButtonIcon('small_round_remove_icon');
        this.updateStatus();
    }

    // Clears the current recording
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
        this.setRecordButtonIcon('small_round_record_icon');
        this.updateStatus();
    }

    // Opens saving when the take is long enough
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

    // Sends the recording to the backend
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
            this.dialog.open(`Saved as a draft! Publish it later from MY VINYL RECORDS to earn ${PUBLISH_REWARD} notes`);
        } catch (error) {
            if (error instanceof Error) throw error;
            throw new Error('Save failed', { cause: error });
        }
    }

    // Provides a default draft name
    private createDefaultTrackName() {
        return 'Toon Tune';
    }

    // Changes the record button icon
    private setRecordButtonIcon(texture: string) {
        this.recordButton?.setIcon(texture, `${texture}_active`);
    }

    // Changes the playback button icon
    private setPlayButtonIcon(texture: string) {
        this.playButton?.setIcon(texture, `${texture}_active`);
    }

    // Asks before publishing a draft
    private confirmPublishTrack() {
        if (!this.track) return;

        this.confirmDialog.open({
            title: 'PUBLISH RECORD?',
            message: `After publishing, this tune stays in post history, cannot be deleted from your list, and pays a ${PUBLISH_REWARD} note reward`,
            confirmLabel: 'Publish',
            onConfirm: async () => {
                await this.publishCurrentTrack();
            },
        });
    }

    // Asks before deleting a draft
    private confirmDeleteTrack() {
        if (!this.track) return;

        this.confirmDialog.open({
            title: 'DELETE RECORD?',
            message: 'This saved draft will disappear from your vinyl shelf',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                await this.deleteCurrentTrack();
            },
        });
    }

    // Publishes the current draft
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
            this.dialog.open(`Published! You earned ${response.bonusNotes} notes.`);
        } catch (error) {
            this.dialog.open(error instanceof Error ? error.message : 'Publish failed');
        }
    }

    // Deletes the current draft
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

            this.dialog.open('Draft deleted. Your current take is still here if you want to save again');
        } catch (error) {
            this.dialog.open(error instanceof Error ? error.message : 'Delete failed');
        }
    }

    // Keeps draft actions hidden on this scene
    private updateTrackActionButtons() {
        // Temporarily hidden: draft management is handled from My Vinyl Records.
        this.publishButton?.setVisible(false);
        this.deleteTrackButton?.setVisible(false);
    }

    // Starts a note from pointer or keyboard input
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
        if (this.activeNotes[inputId] !== fullNote || !this.synth) return;

        this.synth.triggerAttack(fullNote);
        this.triggeredInputs.add(inputId);
    }

    // Releases a note from pointer or keyboard input
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

    // Starts the recording clock on first note
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

    // Stores one timeline event
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

    // Applies a temporary octave shift
    private setOctaveHold(source: string, offset: number) {
        if (this.mode !== 'compose') return;

        this.octaveHolds.set(source, offset);
        this.currentOctaveOffset = this.resolveOctaveOffset();
        this.refreshKeyAnimations();
        if (this.isRecording && this.recordStartedAt !== null) {
            this.recordEvent(PianoEventType.OctaveSet, this.currentOctaveOffset);
        }
        this.updateStatus();
    }

    // Clears a temporary octave shift
    private clearOctaveHold(source: string) {
        if (this.mode !== 'compose') return;

        this.octaveHolds.delete(source);
        this.currentOctaveOffset = this.resolveOctaveOffset();
        this.refreshKeyAnimations();
        if (this.isRecording && this.recordStartedAt !== null) {
            this.recordEvent(PianoEventType.OctaveSet, this.currentOctaveOffset);
        }
        this.updateStatus();
    }

    // Resolves active octave holds
    private resolveOctaveOffset() {
        const values = [...this.octaveHolds.values()];
        if (values.includes(1)) return 1;
        if (values.includes(-1)) return -1;
        return 0;
    }

    // Toggles piano sustain
    private toggleBottomPedal() {
        if (this.mode !== 'compose' || !this.supportsSustainPedal()) return;

        const wasActive = this.isPedalActive();
        this.bottomPedalEnabled = !this.bottomPedalEnabled;
        const isActive = this.isPedalActive();
        if (wasActive && !isActive) this.releaseSustainedNotes();
        if (wasActive !== isActive && this.isRecording && this.recordStartedAt !== null) {
            this.recordEvent(PianoEventType.PedalToggle, isActive);
        }
        this.updateSustainPedalVisual(this.bottomPedalEnabled);
        this.updateStatus();
    }

    // Starts or stops the metronome
    private async toggleMetronome() {
        if (this.mode !== 'compose') return;

        this.metronomeEnabled = !this.metronomeEnabled;
        this.metronomeTimer?.remove(false);
        this.metronomeTimer = undefined;
        this.metronomeFrameStep = 0;
        this.updateMetronomeVisual();

        if (this.isRecording && this.recordStartedAt !== null) {
            this.recordEvent(PianoEventType.MetronomeToggle, this.metronomeEnabled);
        }

        if (this.metronomeEnabled) {
            await this.ensureAudioReady();
            if (!this.metronomeEnabled) return;

            this.ensureMetronomeClickSynth();
            this.metronomeBeat = 0;
            this.metronomeTimer = this.time.addEvent({
                delay: METRONOME_FRAME_MS,
                loop: true,
                callback: () => this.advanceMetronomeFrame(),
            });
        }
    }

    // Updates the metronome animation
    private updateMetronomeVisual() {
        const metronome = this.metronomeSprite;
        if (!metronome?.scene || !metronome.active || !metronome.anims) return;

        const animation = this.metronomeEnabled ? 'metronome_on' : 'metronome_off';
        if (this.anims.exists(animation)) metronome.play(animation, true);
    }

    // Advances the metronome click timing
    private advanceMetronomeFrame() {
        this.metronomeFrameStep = (this.metronomeFrameStep + 1) % 8;
        if (this.metronomeFrameStep === 2 || this.metronomeFrameStep === 6) {
            this.playMetronomeClick();
        }
    }

    // Lazily creates the metronome click synth
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

    // Plays one soft metronome click
    private playMetronomeClick() {
        if (!this.metronomeClickSynth) return;

        const isTick = this.metronomeBeat % 2 === 0;
        this.metronomeClickSynth.triggerAttackRelease(isTick ? 'C6' : 'G5', '32n', undefined, isTick ? 0.42 : 0.32);
        this.metronomeBeat += 1;
    }

    // Checks if sustain is active
    private isPedalActive() {
        return this.supportsSustainPedal() && this.bottomPedalEnabled;
    }

    // Updates the sustain pedal animation
    private updateSustainPedalVisual(isEnabled: boolean) {
        const pedal = this.bottomPedalButton;
        if (!pedal?.scene || !pedal.active || !pedal.anims) return;

        const animation = isEnabled ? 'sustain_on' : 'sustain_off';
        if (this.anims.exists(animation)) pedal.play(animation, true);
    }

    // Limits sustain to supported instruments
    private supportsSustainPedal(instrument = this.currentInstrument) {
        return instrument === InstrumentId.DEFAULT_PIANO;
    }

    // Returns the current recording time
    private getRecordingElapsedMs() {
        if (this.recordStartedAt === null) return this.recordingElapsedMs;

        return Math.min(this.time.now - this.recordStartedAt, this.getMaxDurationMs());
    }

    // Returns the user's max track duration
    private getMaxDurationMs() {
        return (this.user?.maxTrackDuration ?? 30) * 1000;
    }

    // Refreshes the remaining time text
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

    // Refreshes compose status UI
    private updateStatus() {
        this.updateTimeText();
    }

    // Schedules playback timeline events
    private async startPlayback() {
        if (!this.track || this.isPlaying) return;
        await this.ensureAudioReady();

        this.isPlaying = true;
        this.playbackPedalActive = false;
        this.playbackStartedAt = this.time.now;
        this.setPlayButtonIcon('small_round_pause_icon');

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
            this.setPlayButtonIcon('small_round_play_icon');
        });
        this.playbackTimers.push(finishTimer);
    }

    // Toggles play and pause
    private togglePlayback() {
        if (this.isPlaying) {
            this.pausePlayback();
            return;
        }

        void this.startPlayback();
    }

    // Pauses playback and stores the offset
    private pausePlayback() {
        if (!this.isPlaying) return;

        this.playbackOffsetMs += this.time.now - this.playbackStartedAt;
        this.stopPlayback(false);
        this.setPlayButtonIcon('small_round_play_icon');
    }

    // Restarts playback from the beginning
    private restartPlayback() {
        this.stopPlayback();
        this.playbackOffsetMs = 0;
        void this.startPlayback();
    }

    // Stops playback and clears timers
    private stopPlayback(resetOffset = true, updateVisuals = true) {
        this.playbackTimers.forEach((timer) => timer.remove(false));
        this.playbackTimers = [];
        this.releaseAllNotes(updateVisuals);
        this.isPlaying = false;
        this.playbackPedalActive = false;
        if (updateVisuals) this.updateSustainPedalVisual(false);
        if (resetOffset) this.playbackStartedAt = 0;
    }

    // Applies one recorded playback event
    private applyPlaybackEvent(event: PianoEvent) {
        if (event.type === PianoEventType.NoteOn && typeof event.value === 'string') {
            if (!this.synth) return;

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
            if (!this.supportsSustainPedal()) {
                this.playbackPedalActive = false;
                return;
            }

            const wasActive = this.playbackPedalActive;
            this.playbackPedalActive = event.value;
            if (wasActive && !this.playbackPedalActive) this.releaseSustainedNotes();
            this.updateSustainPedalVisual(event.value);
        }
    }

    // Releases all active notes
    private releaseAllNotes(updateVisuals = true) {
        Object.keys(this.activeNotes).forEach((key) => {
            const note = this.activeNotes[key];
            if (note) {
                this.releaseNote(note);
                this.triggeredInputs.delete(key);
                if (updateVisuals) this.highlightKey(this.getNoteName(note), false);
            }
            delete this.activeNotes[key];
        });
        this.releaseSustainedNotes();
    }

    // Releases notes held by sustain
    private releaseSustainedNotes() {
        this.sustainedNotes.forEach((note) => {
            this.releaseNote(note);
        });
        this.sustainedNotes.clear();
    }

    // Releases one sustained note if needed
    private releaseSustainedNote(note: string) {
        if (!this.sustainedNotes.has(note)) return;

        this.releaseNote(note);
        this.sustainedNotes.delete(note);
    }

    // Sends a note release to the synth
    private releaseNote(note: string) {
        this.synth?.triggerRelease(note);
    }

    // Updates a key pressed state
    private highlightKey(noteName: string, isDown: boolean) {
        const keyVisual = this.keyVisuals.get(noteName);
        if (!keyVisual) return;
        if (!keyVisual.sprite.scene || !keyVisual.sprite.active) return;

        if (isDown) {
            this.pressedKeyVisuals.add(noteName);
        } else {
            this.pressedKeyVisuals.delete(noteName);
        }

        this.playKeyAnimation(keyVisual.sprite, keyVisual.color, isDown);
    }

    // Refreshes all key sprites after octave changes
    private refreshKeyAnimations() {
        this.keyVisuals.forEach((keyVisual, noteName) => {
            if (!keyVisual.sprite.scene || !keyVisual.sprite.active) return;

            this.playKeyAnimation(keyVisual.sprite, keyVisual.color, this.pressedKeyVisuals.has(noteName));
        });
    }

    // Safely plays one key animation
    private playKeyAnimation(sprite: Phaser.GameObjects.Sprite, color: PianoKeyColor, isPressed: boolean) {
        const animation = this.getKeyAnimation(color, isPressed);
        if (sprite.scene && sprite.active && this.anims.exists(animation)) sprite.play(animation, true);
    }

    // Chooses the key texture for the octave tier
    private getKeyTexture(color: PianoKeyColor) {
        return `${color}_key_${this.getKeyTier()}`;
    }

    // Builds the key animation name
    private getKeyAnimation(color: PianoKeyColor, isPressed: boolean) {
        return `${this.getKeyTexture(color)}_${isPressed ? 'pressed' : 'idle'}`;
    }

    // Chooses low, middle, or high key art
    private getKeyTier(): PianoKeyTier {
        if (this.currentOctaveOffset < 0) return 'down';
        if (this.currentOctaveOffset > 0) return 'up';
        return 'middle';
    }

    // Removes octave number from a note
    private getNoteName(fullNote: string) {
        return fullNote.replace(/[0-9]/g, '');
    }

    // Reads the starting instrument
    private getInitialInstrument() {
        if (this.track?.instrumentId) {
            return this.getInstrumentById(this.track.instrumentId);
        }

        return InstrumentId.DEFAULT_PIANO;
    }

    // Converts saved instrument ids safely
    private getInstrumentById(id: string) {
        const found = Object.values(InstrumentId).find((instrument) => instrument === id);
        return found ?? InstrumentId.DEFAULT_PIANO;
    }

    // Lists instruments the user can use
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

    // Switches synth and visuals for an instrument
    private changeInstrument(instrument: InstrumentId) {
        const wasPedalActive = this.isPedalActive();
        if (!this.supportsSustainPedal(instrument)) {
            this.bottomPedalEnabled = false;
            this.playbackPedalActive = false;
            this.releaseSustainedNotes();
            if (wasPedalActive && this.isRecording && this.recordStartedAt !== null) {
                this.recordEvent(PianoEventType.PedalToggle, false);
            }
        }

        if (this.synth) this.synth.dispose();

        this.currentInstrument = instrument;
        this.updateInstrumentBackgroundVisual();
        if (isSampledInstrument(instrument)) {
            const preloadedSamples = this.getPreloadedSampleBuffers(instrument);
            if (preloadedSamples) {
                this.instrumentReady = Promise.resolve();
                const sampler = new Tone.Sampler({
                    urls: preloadedSamples,
                    release: NOTE_RELEASE_SECONDS,
                });
                this.synth = instrument === InstrumentId.DEFAULT_PIANO
                    ? this.createPianoSamplerInstrument(sampler)
                    : sampler.toDestination();
                return;
            }

            this.instrumentReady = new Promise((resolve) => {
                const sampler = new Tone.Sampler({
                    urls: this.getFallbackSampleUrls(instrument),
                    baseUrl: `./assets/audio/${instrument === InstrumentId.DEFAULT_PIANO ? 'piano' : 'organ'}/`,
                    release: NOTE_RELEASE_SECONDS,
                    onload: resolve,
                });

                this.synth = instrument === InstrumentId.DEFAULT_PIANO
                    ? this.createPianoSamplerInstrument(sampler)
                    : sampler.toDestination();
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

    // Adds a piano-only safety chain to prevent stacked sample peaks
    private createPianoSamplerInstrument(sampler: Tone.Sampler): PlayableInstrument {
        const volume = new Tone.Volume(PIANO_VOLUME_DB);
        const limiter = new Tone.Limiter(PIANO_LIMITER_DB);
        sampler.chain(volume, limiter, Tone.Destination);

        return {
            triggerAttack: (note) => sampler.triggerAttack(note),
            triggerRelease: (note, time) => sampler.triggerRelease(note, time),
            dispose: () => {
                sampler.dispose();
                volume.dispose();
                limiter.dispose();
            },
        };
    }

    // Reads preloaded sample buffers
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

    // Builds fallback sample urls
    private getFallbackSampleUrls(instrument: SampledInstrumentId): Record<string, string> {
        const urls: Record<string, string> = {};
        const samples = AUDIO_SAMPLE_ASSETS.filter((sample) => sample.instrument === instrument);

        samples.forEach((sample) => {
            urls[sample.note] = sample.path.split('/').at(-1) ?? '';
        });

        return urls;
    }

    // Starts Tone before playing sound
    private async ensureAudioReady() {
        if (Tone.context.state !== 'running') await Tone.start();
        await this.instrumentReady;
    }

    // Cleans timers, listeners, and synths
    private shutdownScene() {
        this.scale.off('resize', this.resizeHandler);
        this.input.keyboard?.off('keydown', this.keyboardDownHandler);
        this.input.keyboard?.off('keyup', this.keyboardUpHandler);
        this.playbackStartTimer?.remove(false);
        this.playbackStartTimer = undefined;
        this.timeTimer?.remove(false);
        this.timeTimer = undefined;
        this.metronomeTimer?.remove(false);
        this.metronomeTimer = undefined;
        this.stopPlayback(true, false);
        this.metronomeClickSynth?.dispose();
        this.metronomeClickSynth = undefined;
        this.synth?.dispose();
        this.synth = undefined;
        this.pianoBackground = undefined;
    }
}
