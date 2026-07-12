import Phaser from 'phaser';
import { TextSpriteButton } from './TextSpriteButton';
import { fitImageByScreenMinSide } from '../utils/sceneBackground';

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
    private panel: Phaser.GameObjects.Image;
    private title: Phaser.GameObjects.Text;
    private helper: Phaser.GameObjects.Text;
    private inputBox: Phaser.GameObjects.Rectangle;
    private inputText: Phaser.GameObjects.Text;
    private htmlInput: HTMLInputElement;
    private errorText: Phaser.GameObjects.Text;
    private counterText: Phaser.GameObjects.Text;
    private saveButton: TextSpriteButton;
    private cancelButton: TextSpriteButton;
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

        this.background = cfg.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive();

        this.panel = cfg.scene.add.image(width / 2, height / 2, 'dialog_bg');

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
        this.inputBox.setInteractive({ useHandCursor: true });
        this.inputBox.on('pointerdown', () => this.focusHtmlInput());

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

        this.saveButton = new TextSpriteButton({
            scene: cfg.scene,
            x: width / 2 - 88,
            y: height * 0.69,
            width: 150,
            height: 46,
            backgroundTexture: 'small_text_button_bg',
            backgroundAnimation: 'small_text_button_bg_active',
            label: 'SAVE',
            onClick: () => this.submit(),
        });

        this.cancelButton = new TextSpriteButton({
            scene: cfg.scene,
            x: width / 2,
            y: height * 0.69,
            width: 160,
            height: 46,
            backgroundTexture: 'small_text_button_bg',
            backgroundAnimation: 'small_text_button_bg_active',
            contentTexture: 'small_text_button_cancel',
            contentAnimation: 'small_text_button_cancel_active',
            onClick: () => this.close(),
        });

        this.htmlInput = document.createElement('input');
        this.htmlInput.type = 'text';
        this.htmlInput.maxLength = MAX_NAME_LENGTH;
        this.htmlInput.inputMode = 'text';
        this.htmlInput.autocomplete = 'off';
        this.htmlInput.spellcheck = false;
        this.htmlInput.style.position = 'fixed';
        this.htmlInput.style.zIndex = '10000';
        this.htmlInput.style.opacity = '0.01';
        this.htmlInput.style.border = '0';
        this.htmlInput.style.padding = '0';
        this.htmlInput.style.margin = '0';
        this.htmlInput.style.background = 'transparent';
        this.htmlInput.style.color = 'transparent';
        this.htmlInput.style.caretColor = 'transparent';
        this.htmlInput.style.fontSize = '16px';
        this.htmlInput.style.outline = 'none';
        this.htmlInput.style.display = 'none';
        this.htmlInput.addEventListener('input', () => this.syncHtmlInputValue());
        this.htmlInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void this.submit();
            }
        });
        document.body.appendChild(this.htmlInput);

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
        this.htmlInput.value = this.value;
        this.htmlInput.style.display = 'block';
        this.refreshLayout();
        this.setVisible(true);
        this.ownerScene.input.keyboard?.on('keydown', this.keyHandler);
        this.focusHtmlInput();
    }

    public close() {
        this.ownerScene.input.keyboard?.off('keydown', this.keyHandler);
        this.htmlInput.blur();
        this.htmlInput.style.display = 'none';
        this.setVisible(false);
    }

    public override destroy(fromScene?: boolean) {
        this.ownerScene.input.keyboard?.off('keydown', this.keyHandler);
        this.ownerScene.scale.off('resize', this.resizeHandler);
        this.htmlInput.remove();
        super.destroy(fromScene);
    }

    private handleKey(event: KeyboardEvent) {
        if (!this.visible || this.isSaving) return;
        if (document.activeElement === this.htmlInput) return;

        if (event.key === 'Backspace') {
            event.preventDefault();
            this.value = this.value.slice(0, -1);
            this.errorText.setText('');
            this.updateInputText();
            this.htmlInput.value = this.value;
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
        this.htmlInput.value = this.value;
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

    private syncHtmlInputValue() {
        if (!this.visible || this.isSaving) return;

        this.value = this.htmlInput.value
            .replace(/[^a-zA-Z0-9 !?'-]/g, '')
            .slice(0, MAX_NAME_LENGTH);
        this.htmlInput.value = this.value;
        this.errorText.setText('');
        this.updateInputText();
    }

    private focusHtmlInput() {
        if (!this.visible) return;

        this.htmlInput.focus();
    }

    private refreshLayout() {
        const { width, height } = this.ownerScene.scale;

        this.background.setSize(width, height);
        fitImageByScreenMinSide(this.panel, width, height);

        const panelWidth = this.panel.displayWidth;
        const panelHeight = this.panel.displayHeight;
        const panelX = this.panel.x;
        const panelY = this.panel.y;
        const inputWidth = Math.min(280, panelWidth * 0.52);

        this.title.setPosition(panelX, panelY - panelHeight * 0.28);
        this.helper.setPosition(panelX, panelY - panelHeight * 0.17);
        this.inputBox.setPosition(panelX, panelY - panelHeight * 0.03);
        this.inputBox.setSize(inputWidth, 54);
        this.inputText.setPosition(panelX, panelY - panelHeight * 0.03);
        this.layoutHtmlInput(inputWidth, 54);
        this.counterText.setPosition(panelX, panelY + panelHeight * 0.08);
        this.errorText.setPosition(panelX, panelY + panelHeight * 0.16);

        const buttonWidth = Math.min(160, panelWidth * 0.5);
        const buttonStep = Math.max(52, panelHeight * 0.08);
        const buttonCenterY = panelY + panelHeight * 0.35;
        this.saveButton.resize(buttonWidth, 46, 15);
        this.cancelButton.resize(buttonWidth, 46, 15);
        this.saveButton.setPosition(panelX, buttonCenterY - buttonStep / 2);
        this.cancelButton.setPosition(panelX, buttonCenterY + buttonStep / 2);
    }

    private layoutHtmlInput(inputWidth: number, inputHeight: number) {
        const canvasBounds = this.ownerScene.game.canvas.getBoundingClientRect();
        const scaleX = canvasBounds.width / this.ownerScene.scale.width;
        const scaleY = canvasBounds.height / this.ownerScene.scale.height;

        this.htmlInput.style.left = `${canvasBounds.left + (this.inputBox.x - inputWidth / 2) * scaleX}px`;
        this.htmlInput.style.top = `${canvasBounds.top + (this.inputBox.y - inputHeight / 2) * scaleY}px`;
        this.htmlInput.style.width = `${inputWidth * scaleX}px`;
        this.htmlInput.style.height = `${inputHeight * scaleY}px`;
    }
}
