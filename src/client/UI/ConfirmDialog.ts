import Phaser from 'phaser';
import { TextSpriteButton } from './TextSpriteButton';
import { fitImageByScreenMinSide } from '../utils/sceneBackground';

type ConfirmDialogConfig = {
    scene: Phaser.Scene;
};

type OpenConfirmConfig = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
};

export class ConfirmDialog extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Rectangle;
    private panel: Phaser.GameObjects.Image;
    private title: Phaser.GameObjects.Text;
    private message: Phaser.GameObjects.Text;
    private confirmButton: TextSpriteButton;
    private cancelButton: TextSpriteButton;
    private onConfirm: () => void | Promise<void> = () => undefined;
    private resizeHandler: () => void;
    private ownerScene: Phaser.Scene;

    constructor(cfg: ConfirmDialogConfig) {
        super(cfg.scene, 0, 0);
        this.ownerScene = cfg.scene;
        this.resizeHandler = () => this.refreshLayout();

        const { width, height } = cfg.scene.scale;

        this.background = cfg.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive();

        this.panel = cfg.scene.add.image(width / 2, height / 2, 'dialog_bg');

        this.title = cfg.scene.add.text(width / 2, height * 0.32, '', {
            color: '#f8d66d',
            fontSize: '30px',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: width * 0.68 },
        }).setOrigin(0.5);

        this.message = cfg.scene.add.text(width / 2, height * 0.46, '', {
            color: '#ffffff',
            fontSize: '22px',
            align: 'center',
            wordWrap: { width: width * 0.68 },
        }).setOrigin(0.5);

        this.confirmButton = new TextSpriteButton({
            scene: cfg.scene,
            x: width / 2,
            y: height * 0.66,
            width: 160,
            height: 46,
            backgroundTexture: 'small_text_button_bg',
            backgroundAnimation: 'small_text_button_bg_active',
            label: 'Continue',
            onClick: async () => {
                this.close();
                await this.onConfirm();
            },
        });

        this.cancelButton = new TextSpriteButton({
            scene: cfg.scene,
            x: width / 2,
            y: height * 0.66,
            width: 160,
            height: 46,
            backgroundTexture: 'small_text_button_bg',
            backgroundAnimation: 'small_text_button_bg_active',
            contentTexture: 'small_text_button_cancel',
            contentAnimation: 'small_text_button_cancel_active',
            label: 'Cancel',
            onClick: () => this.close(),
        });

        this.add([
            this.background,
            this.panel,
            this.title,
            this.message,
            this.confirmButton,
            this.cancelButton,
        ]);

        this.setDepth(9000);
        this.setVisible(false);

        cfg.scene.scale.on('resize', this.resizeHandler);
        cfg.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
        cfg.scene.add.existing(this);
    }

    // Opens a confirm dialog
    public open(cfg: OpenConfirmConfig) {
        this.onConfirm = cfg.onConfirm;
        this.title.setText(cfg.title);
        this.message.setText(cfg.message);
        this.confirmButton.setLabel(cfg.confirmLabel ?? 'Continue');
        this.cancelButton.setLabel(cfg.cancelLabel ?? 'Cancel');
        this.refreshLayout();
        this.setVisible(true);
    }

    // Hides the dialog
    public close() {
        this.setVisible(false);
    }

    // Removes resize listeners
    public override destroy(fromScene?: boolean) {
        this.ownerScene.scale.off('resize', this.resizeHandler);
        super.destroy(fromScene);
    }

    // Repositions dialog content
    private refreshLayout() {
        const { width, height } = this.ownerScene.scale;

        this.background.setSize(width, height);
        fitImageByScreenMinSide(this.panel, width, height);

        const panelWidth = this.panel.displayWidth;
        const panelHeight = this.panel.displayHeight;
        const panelX = this.panel.x;
        const panelY = this.panel.y;

        this.title.setPosition(panelX, panelY - panelHeight * 0.26);
        this.title.setWordWrapWidth(panelWidth * 0.68);
        this.message.setPosition(panelX, panelY - panelHeight * 0.03);
        this.message.setWordWrapWidth(panelWidth * 0.7);

        const buttonWidth = Math.min(160, panelWidth * 0.5);
        const buttonStep = Math.max(52, panelHeight * 0.08);
        const buttonCenterY = panelY + panelHeight * 0.31;
        this.confirmButton.resize(buttonWidth, 46, 15);
        this.cancelButton.resize(buttonWidth, 46, 15);
        this.confirmButton.setPosition(panelX, buttonCenterY - buttonStep / 2);
        this.cancelButton.setPosition(panelX, buttonCenterY + buttonStep / 2);
    }
}
