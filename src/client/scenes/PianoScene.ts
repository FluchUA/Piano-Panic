import { Scene } from 'phaser';
import * as Tone from 'tone';

type SynthType = 'SamplerPiano' | 'Synth' | 'SamplerOrgan' | 'FMSynth' | 'MonoSynth';

export class PianoScene extends Scene {
    private synth!: Tone.PolySynth | Tone.Sampler;
    private currentSynthType: SynthType = 'SamplerPiano';

    private activeNotes: { [key: string]: string } = {};
    private isPedalPressed: boolean = false;
    private currentOctaveOffset: number = 0;

    private keyboardMap: Record<string, string> = {
        'Z': 'C', 'S': 'C#', 'X': 'D', 'D': 'D#', 'C': 'E',
        'V': 'F', 'G': 'F#', 'B': 'G', 'H': 'G#', 'N': 'A', 'J': 'A#', 'M': 'B'
    };

    private octaveText!: Phaser.GameObjects.Text;
    private pedalText!: Phaser.GameObjects.Text;
    private uiGroup!: Phaser.GameObjects.Group;

    private instruments: { id: SynthType; name: string }[] = [
        { id: 'SamplerPiano', name: '🎹 Пианино (Сэмплы)' },
        { id: 'Synth', name: '🎹 Пианино (Синт)' },
        { id: 'SamplerOrgan', name: '⛪ Орган (Сэмплы)' },
        { id: 'FMSynth', name: '⚡ Электро (Синт)' },
        { id: 'MonoSynth', name: '🎛️ Ретро (Синт)' }
    ];

    constructor() {
        super('PianoScene');
    }

    create() {
        this.changeInstrument('SamplerPiano');

        // ХАК ДЛЯ МУЛЬТИТАЧА: Добавляем 5 дополнительных поинтеров.
        // Теперь игра сможет обрабатывать до 6 одновременных касаний на экране телефона!
        this.input.addPointer(5);

        this.uiGroup = this.add.group();
        this.refreshLayout();

        this.scale.on('resize', () => this.refreshLayout());

        this.setupModifiers();
        this.setupKeyboardNotes();
    }

    private changeInstrument(type: SynthType) {
        if (this.synth) {
            this.synth.dispose();
        }

        this.currentSynthType = type;

        if (type === 'SamplerPiano' || type === 'SamplerOrgan') {
            const folder = type === 'SamplerPiano' ? 'piano' : 'organ';
            
            this.synth = new Tone.Sampler({
                urls: {
                    "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", "A3": "A3.mp3",
                    "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", "A4": "A4.mp3",
                    "C5": "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", "A5": "A5.mp3",
                    "C6": "C6.mp3"
                },
                baseUrl: `./assets/audio/${folder}/`,
                onload: () => {
                    console.log(`[Tone.js] Сэмплы для ${type} успешно загружены!`);
                }
            }).toDestination();

        } else {
            let voiceConstructor: any = Tone.Synth;
            if (type === 'FMSynth') voiceConstructor = Tone.FMSynth;
            else if (type === 'MonoSynth') voiceConstructor = Tone.MonoSynth;

            this.synth = new Tone.PolySynth(voiceConstructor).toDestination();
            this.synth.set({
                envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.1 }
            });
        }
    }

    private refreshLayout() {
        this.uiGroup.clear(true, true);

        const width = this.scale.width;
        const height = this.scale.height;

        // --- 1. КНОПКИ МЕНЮ ИНСТРУМЕНТОВ ---
        const maxCols = 3;
        const btnWidth = Math.min(140, Math.floor((width * 0.9) / maxCols));
        const btnHeight = 35;
        const startBtnY = 20;

        this.instruments.forEach((inst, index) => {
            const row = Math.floor(index / maxCols);
            const col = index % maxCols;

            const totalInThisRow = row === 0 ? maxCols : (this.instruments.length - maxCols);
            const startBtnX = (width - (totalInThisRow * (btnWidth + 10))) / 2;

            const x = startBtnX + col * (btnWidth + 10);
            const y = startBtnY + row * (btnHeight + 8);

            const isActive = this.currentSynthType === inst.id;
            const bgColor = isActive ? 0x00ff00 : 0x444444;
            const textColor = isActive ? '#000000' : '#ffffff';

            const btnBg = this.add.rectangle(x, y, btnWidth, btnHeight, bgColor)
                .setOrigin(0)
                .setInteractive({ useHandCursor: true });

            const btnText = this.add.text(x + btnWidth / 2, y + btnHeight / 2, inst.name, {
                fontSize: '11px',
                color: textColor,
                fontStyle: 'bold'
            }).setOrigin(0.5);

            btnBg.on('pointerdown', () => {
                this.changeInstrument(inst.id);
                this.refreshLayout();
            });

            this.uiGroup.add(btnBg);
            this.uiGroup.add(btnText);
        });

        // --- 2. ИНФОРМАЦИОННАЯ ПАНЕЛЬ ---
        this.octaveText = this.add.text(width / 2, 115, '', { fontSize: '15px', color: '#fff' }).setOrigin(0.5);
        this.pedalText = this.add.text(width / 2, 140, '', { fontSize: '15px', color: '#ff0000' }).setOrigin(0.5);

        this.uiGroup.add(this.octaveText);
        this.uiGroup.add(this.pedalText);

        // --- 3. ГЕОМЕТРИЯ ДЛЯ ОДНОЙ ОКТАВЫ ---
        const totalWhiteKeys = 7;
        const whiteKeyWidth = Math.min(55, Math.floor((width * 0.8) / totalWhiteKeys));
        const whiteKeyHeight = Math.floor(height * 0.4);
        const startPianoX = (width - (totalWhiteKeys * whiteKeyWidth)) / 2;
        const startPianoY = height * 0.48;

        const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const blackNotes = [
            { note: 'C#', afterWhiteIndex: 0 }, // После C
            { note: 'D#', afterWhiteIndex: 1 }, // После D
            { note: 'F#', afterWhiteIndex: 3 }, // После F
            { note: 'G#', afterWhiteIndex: 4 }, // После G
            { note: 'A#', afterWhiteIndex: 5 }  // После A
        ];

        // Пасс 1: Рисуем белые клавиши
        whiteNotes.forEach((note, index) => {
            const x = startPianoX + index * whiteKeyWidth;
            const y = startPianoY;
            const w = whiteKeyWidth - 2;
            const h = whiteKeyHeight;

            const keyButton = this.add.rectangle(x, y, w, h, 0xffffff)
                .setOrigin(0)
                .setInteractive({ useHandCursor: true })
                .setStrokeStyle(1, 0x000000);

            keyButton.on('pointerdown', () => {
                keyButton.setAlpha(0.7);
                this.playNote(note, note);
            });

            const releaseHandler = () => {
                keyButton.setAlpha(1);
                this.stopNote(note);
            };

            keyButton.on('pointerup', releaseHandler);
            keyButton.on('pointerout', releaseHandler);

            this.uiGroup.add(keyButton);

            const text = this.add.text(x + w / 2, y + h + 15, note, { color: '#fff', fontSize: '13px' }).setOrigin(0.5);
            this.uiGroup.add(text);
        });

        // Пасс 2: Рисуем черные клавиши поверх белых
        blackNotes.forEach(({ note, afterWhiteIndex }) => {
            const w = Math.floor(whiteKeyWidth * 0.65);
            const h = Math.floor(whiteKeyHeight * 0.6);
            
            const x = startPianoX + (afterWhiteIndex + 1) * whiteKeyWidth - (w / 2);
            const y = startPianoY;

            const keyButton = this.add.rectangle(x, y, w, h, 0x111111)
                .setOrigin(0)
                .setInteractive({ useHandCursor: true });

            keyButton.on('pointerdown', () => {
                keyButton.setAlpha(0.7);
                this.playNote(note, note);
            });

            const releaseHandler = () => {
                keyButton.setAlpha(1);
                this.stopNote(note);
            };

            keyButton.on('pointerup', releaseHandler);
            keyButton.on('pointerout', releaseHandler);

            this.uiGroup.add(keyButton);
        });

        this.updateUI();
    }

    private setupModifiers() {
        if (!this.input.keyboard) return;

        this.input.keyboard.on('keydown-Q', () => { this.currentOctaveOffset = -1; this.updateUI(); });
        this.input.keyboard.on('keyup-Q', () => { this.currentOctaveOffset = 0; this.updateUI(); });

        this.input.keyboard.on('keydown-E', () => { this.currentOctaveOffset = 1; this.updateUI(); });
        this.input.keyboard.on('keyup-E', () => { this.currentOctaveOffset = 0; this.updateUI(); });

        this.input.keyboard.on('keydown-W', () => { this.isPedalPressed = true; this.updateUI(); });
        this.input.keyboard.on('keyup-W', () => { this.isPedalPressed = false; this.updateUI(); });
    }

    private setupKeyboardNotes() {
        if (!this.input.keyboard) return;

        this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
            const keyName = event.key.toUpperCase();
            const note = this.keyboardMap[keyName];
            if (note && !this.activeNotes[keyName]) {
                this.playNote(note, keyName);
            }
        });

        this.input.keyboard.on('keyup', (event: KeyboardEvent) => {
            const keyName = event.key.toUpperCase();
            if (this.keyboardMap[keyName]) {
                this.stopNote(keyName);
            }
        });
    }

    private updateUI() {
        if (this.octaveText && this.pedalText) {
            this.octaveText.setText(`Октава: ${4 + this.currentOctaveOffset} (Q - ниже, E - выше)`);
            this.pedalText.setText(`Педаль (W): ${this.isPedalPressed ? 'ВКЛ (Сустейн)' : 'ОТКЛ'}`);
            this.pedalText.setColor(this.isPedalPressed ? '#00ff00' : '#ff0000');
        }
    }

    private playNote(noteName: string, inputId: string) {
        if (Tone.context.state !== 'running') {
            Tone.start();
        }
        const baseOctave = 4;
        const targetOctave = baseOctave + this.currentOctaveOffset;
        const fullNote = `${noteName}${targetOctave}`;

        this.activeNotes[inputId] = fullNote;
        this.synth.triggerAttack(fullNote);
    }

    private stopNote(inputId: string) {
        const fullNote = this.activeNotes[inputId];
        if (fullNote) {
            const currentRelease = this.isPedalPressed ? 2.5 : 0.1;

            if (this.synth instanceof Tone.Sampler) {
                this.synth.triggerRelease(fullNote, `+${currentRelease}`);
            } else {
                this.synth.set({ envelope: { release: currentRelease } });
                this.synth.triggerRelease(fullNote);
            }

            delete this.activeNotes[inputId];
        }
    }
}