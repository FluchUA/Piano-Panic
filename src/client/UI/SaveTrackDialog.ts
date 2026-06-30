import Phaser from 'phaser';
import { ToonButton } from './ToonButton';

type SaveTrackDialogConfig = {
    scene: Phaser.Scene;
};

type OpenSaveTrackConfig = {
    initialName?: string;
    onSave: (name: string) => Promise<void>;
};

const MAX_NAME_LENGTH = 10;

export class SaveTrackDialog extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Rectangle;
    private panel: Phaser.GameObjects.Rectangle;
    private title: Phaser.GameObjects.Text;
    private helper: Phaser.GameObjects.Text;
    private inputBox: Phaser.GameObjects.Rectangle;
    private inputText: Phaser.GameObjects.Text;
    private errorText: Phaser.GameObjects.Text;
    private counterText: Phaser.GameObjects.Text;
    private saveButton: ToonButton;
    private cancelButton: ToonButton;
    private resizeHandler: () => void;
    private keyHandler: (event: KeyboardEvent) => void;
    private onSave: (name: string) => Promise<void> = async () => undefined;
    private value = '';
    private isSaving = false;
    private ownerScene: Phaser.Scene;

    constructor(cfg: SaveTrackDialogConfig) {
        super(cfg.scene, 0, 0);
        this.ownerScene = cfg.scene;
        const { width, height } = cfg.scene.scale;

        this.resizeHandler = () => this.refreshLayout();
        this.keyHandler = (event) => this.handleKey(event);

        this.background = cfg.scene.add.rectangle(0, 0, width, height, 0x000000, 0.74)
            .setOrigin(0)
            .setInteractive();

        this.panel = cfg.scene.add.rectangle(width / 2, height / 2, width * 0.84, height * 0.62, 0x16100d)
            .setStrokeStyle(4, 0xf8d66d);

        this.title = cfg.scene.add.text(width / 2, height * 0.29, 'NAME YOUR TUNE', {
            color: '#f8d66d',
            fontSize: '30px',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5);

        this.helper = cfg.scene.add.text(width / 2, height * 0.37, '10 characters max', {
            color: '#ffffff',
            fontSize: '18px',
            align: 'center',
        }).setOrigin(0.5);

        this.inputBox = cfg.scene.add.rectangle(width / 2, height * 0.47, 260, 54, 0xffffff)
            .setStrokeStyle(4, 0x2f2118);

        this.inputText = cfg.scene.add.text(width / 2, height * 0.47, '', {
            color: '#2f2118',
            fontSize: '24px',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5);

        this.counterText = cfg.scene.add.text(width / 2, height * 0.54, '0/10', {
            color: '#fff4c2',
            fontSize: '15px',
            align: 'center',
        }).setOrigin(0.5);

        this.errorText = cfg.scene.add.text(width / 2, height * 0.59, '', {
            color: '#ff9f9f',
            fontSize: '16px',
            align: 'center',
        }).setOrigin(0.5);

        this.saveButton = new ToonButton({
            scene: cfg.scene,
            x: width / 2 - 88,
            y: height * 0.69,
            width: 150,
            height: 48,
            label: 'SAVE',
            onClick: () => this.submit(),
        });

        this.cancelButton = new ToonButton({
            scene: cfg.scene,
            x: width / 2 + 88,
            y: height * 0.69,
            width: 150,
            height: 48,
            label: 'CANCEL',
            onClick: () => this.close(),
        });

        this.add([
            this.background,
            this.panel,
            this.title,
            this.helper,
            this.inputBox,
            this.inputText,
            this.counterText,
            this.errorText,
            this.saveButton,
            this.cancelButton,
        ]);

        this.setDepth(9200);
        this.setVisible(false);
        cfg.scene.scale.on('resize', this.resizeHandler);
        cfg.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
        cfg.scene.add.existing(this);
    }

    public open(cfg: OpenSaveTrackConfig) {
        this.value = (cfg.initialName ?? '').slice(0, MAX_NAME_LENGTH);
        this.onSave = cfg.onSave;
        this.isSaving = false;
        this.errorText.setText('');
        this.saveButton.setDisabled(false);
        this.updateInputText();
        this.refreshLayout();
        this.setVisible(true);
        this.ownerScene.input.keyboard?.on('keydown', this.keyHandler);
    }

    public close() {
        this.ownerScene.input.keyboard?.off('keydown', this.keyHandler);
        this.setVisible(false);
    }

    public override destroy(fromScene?: boolean) {
        this.ownerScene.input.keyboard?.off('keydown', this.keyHandler);
        this.ownerScene.scale.off('resize', this.resizeHandler);
        super.destroy(fromScene);
    }

    private handleKey(event: KeyboardEvent) {
        if (!this.visible || this.isSaving) return;

        if (event.key === 'Backspace') {
            event.preventDefault();
            this.value = this.value.slice(0, -1);
            this.errorText.setText('');
            this.updateInputText();
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            void this.submit();
            return;
        }

        if (event.key.length !== 1) return;
        if (!/^[a-zA-Z0-9 !?'-]$/.test(event.key)) return;

        event.preventDefault();
        if (this.value.length >= MAX_NAME_LENGTH) {
            this.errorText.setText('10 characters max!');
            return;
        }

        this.value = `${this.value}${event.key}`;
        this.errorText.setText('');
        this.updateInputText();
    }

    private async submit() {
        if (this.isSaving) return;

        const name = this.value.trim();
        if (!name) {
            this.errorText.setText('Name it first, Maestro!');
            return;
        }

        this.isSaving = true;
        this.saveButton.setDisabled(true);
        this.errorText.setText('');

        try {
            await this.onSave(name);
            this.close();
        } catch (error) {
            this.errorText.setText(error instanceof Error ? error.message : 'Save failed');
            this.saveButton.setDisabled(false);
            this.isSaving = false;
        }
    }

    private updateInputText() {
        this.inputText.setText(this.value || 'TYPE NAME');
        this.inputText.setAlpha(this.value ? 1 : 0.42);
        this.counterText.setText(`${this.value.length}/${MAX_NAME_LENGTH}`);
    }

    private refreshLayout() {
        const { width, height } = this.ownerScene.scale;
        const isCompact = width < 520;
        const panelWidth = Math.min(520, width * 0.84);

        this.background.setSize(width, height);
        this.panel.setPosition(width / 2, height / 2);
        this.panel.setSize(panelWidth, isCompact ? height * 0.72 : height * 0.62);
        this.title.setPosition(width / 2, height * 0.29);
        this.helper.setPosition(width / 2, height * 0.37);
        this.inputBox.setPosition(width / 2, height * 0.47);
        this.inputBox.setSize(Math.min(280, width * 0.58), 54);
        this.inputText.setPosition(width / 2, height * 0.47);
        this.counterText.setPosition(width / 2, height * 0.54);
        this.errorText.setPosition(width / 2, height * 0.59);

        if (isCompact) {
            this.saveButton.resize(panelWidth * 0.68, 46, 16);
            this.cancelButton.resize(panelWidth * 0.68, 46, 16);
            this.saveButton.setPosition(width / 2, height * 0.67);
            this.cancelButton.setPosition(width / 2, height * 0.77);
            return;
        }

        const buttonGap = Math.min(190, width * 0.28);
        this.saveButton.resize(150, 48, 18);
        this.cancelButton.resize(150, 48, 18);
        this.saveButton.setPosition(width / 2 - buttonGap / 2, height * 0.69);
        this.cancelButton.setPosition(width / 2 + buttonGap / 2, height * 0.69);
    }
}
